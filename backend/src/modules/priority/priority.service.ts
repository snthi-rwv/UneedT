import { Injectable } from '@nestjs/common';
import { AiClient } from '../../integrations/ai/ai.client';
import { CRITICAL_THRESHOLD, scoreTask } from './priority.calculator';
import { PRIORITY_SYSTEM_PROMPT } from './priority.prompts';
import { PriorityRepository } from './priority.repository';

const DAY = 86_400_000;
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

@Injectable()
export class PriorityService {
    constructor(private readonly repo: PriorityRepository, private readonly ai: AiClient) {}

    /** Recalcula el puntaje base de todas las tareas abiertas (sin IA). */
    async recompute(userId: string) {
        const now = new Date();
        const open = await this.repo.openTasks(userId);
        await this.repo.saveScores(open.map((t) => {
            const { score, reason } = scoreTask(t, t.subject, now);
            return { id: t.id, priorityScore: score, priorityReason: reason, critical: score >= CRITICAL_THRESHOLD };
        }));
    }

    /** Pide a la IA un ajuste de ±10 puntos y un motivo. Si la IA falla, queda el puntaje base. */
    async refineWithAi(userId: string) {
        await this.recompute(userId);
        const top = await this.repo.topOpenTasks(userId, 15);
        if (!top.length) return { refined: 0, usedAi: false };

        // Solo se envía lo necesario para priorizar
        const now = Date.now();
        const input = top.map((t) => ({
            id: t.id,
            titulo: t.title,
            materia: t.subject?.name ?? null,
            dificultadMateria: t.subject?.difficulty ?? null,
            notaActual: t.subject?.currentGrade ?? null,
            pesoPct: t.weightPct,
            complejidad: t.complexity,
            horasPendientes: Math.max(t.estimatedHours - t.hoursSpent, 0),
            diasParaEntrega: Math.round(((t.dueDate.getTime() - now) / DAY) * 10) / 10,
            puntajeBase: t.priorityScore,
        }));

        const out = await this.ai.completeJson<{ id: string; adjustment: number; reason: string }[]>(
            PRIORITY_SYSTEM_PROMPT, JSON.stringify(input), 1500,
        );
        if (!Array.isArray(out)) return { refined: 0, usedAi: false };

        // Se valida todo lo que devuelve la IA antes de guardarlo
        const byId = new Map(top.map((t) => [t.id, t]));
        const updates = out
            .filter((o) => byId.has(o.id) && Number.isFinite(o.adjustment))
            .map((o) => {
                const t = byId.get(o.id)!;
                const score = clamp(Math.round((t.priorityScore + clamp(Math.round(o.adjustment), -10, 10)) * 10) / 10, 0, 100);
                return {
                    id: t.id,
                    priorityScore: score,
                    critical: score >= CRITICAL_THRESHOLD,
                    priorityReason: String(o.reason || t.priorityReason).slice(0, 200),
                };
            });
        await this.repo.saveScores(updates);
        return { refined: updates.length, usedAi: true };
    }
}