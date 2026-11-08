import { Injectable } from '@nestjs/common';
import { AiClient } from '../../integrations/ai/ai.client';
import { CRITICAL_THRESHOLD, scoreTask } from './priority.calculator';
import { PRIORITY_SYSTEM_PROMPT } from './priority.prompts';
import { PriorityRepository } from './priority.repository';

const DAY = 86_400_000;
const AUTO_EVERY_MS = 6 * 3_600_000; // repriorización automática con IA: como máximo una cada 6 horas
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);
const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class PriorityService {
    constructor(private readonly repo: PriorityRepository, private readonly ai: AiClient) {}

    /**
     * Recalcula el puntaje de todas las tareas abiertas: fórmula + el último ajuste de la IA.
     * El ajuste de la IA se guarda aparte, así no se pierde cada vez que cambia la urgencia.
     */
    async recompute(userId: string) {
        const now = new Date();
        const open = await this.repo.openTasks(userId);
        await this.repo.saveScores(open.map((t) => {
            const base = scoreTask(t, t.subject, now);
            const score = round1(clamp(base.score + t.aiAdjustment, 0, 100));
            return { id: t.id, priorityScore: score, priorityReason: t.aiReason || base.reason, critical: score >= CRITICAL_THRESHOLD };
        }));
    }

    /** Pide a la IA un ajuste de ±10 puntos y un motivo para las 15 tareas más importantes. Si la IA falla, queda la fórmula. */
    async refineWithAi(userId: string) {
        const now = new Date();
        const open = await this.repo.openTasks(userId);
        const top = open
            .map((t) => ({ t, base: scoreTask(t, t.subject, now).score }))
            .sort((a, b) => b.base - a.base)
            .slice(0, 15);
        if (!top.length || !this.ai.enabled) {
            await this.recompute(userId);
            return { refined: 0, usedAi: false, failed: false }; // nada que priorizar o IA no configurada
        }

        // Solo se envía lo necesario para priorizar
        const input = top.map(({ t, base }) => ({
            id: t.id,
            titulo: t.title,
            materia: t.subject?.name ?? null,
            dificultadMateria: t.subject?.difficulty ?? null,
            notaActual: t.subject?.currentGrade ?? null,
            pesoPct: t.weightPct,
            complejidad: t.complexity,
            horasPendientes: Math.max(t.estimatedHours - t.hoursSpent, 0),
            diasParaEntrega: Math.round(((t.dueDate.getTime() - now.getTime()) / DAY) * 10) / 10,
            puntajeBase: base,
        }));

        const out = await this.ai.completeJson<{ id: string; adjustment: number; reason: string }[]>(
            PRIORITY_SYSTEM_PROMPT, JSON.stringify(input), 1500,
        );
        if (!Array.isArray(out)) {
            await this.recompute(userId);
            return { refined: 0, usedAi: false, failed: true };
        }

        // Se valida todo lo que devuelve la IA antes de guardarlo
        const ids = new Set(top.map(({ t }) => t.id));
        const updates = out
            .filter((o) => o && ids.has(o.id) && Number.isFinite(o.adjustment))
            .map((o) => ({
                id: o.id,
                aiAdjustment: clamp(Math.round(o.adjustment), -10, 10),
                aiReason: String(o.reason ?? '').trim().slice(0, 200) || null,
            }));
        await this.repo.saveAiAdjustments(updates);
        await this.recompute(userId);
        await this.repo.setPrioritizedAt(userId, now);
        return { refined: updates.length, usedAi: true, failed: false };
    }

    /**
     * Repriorización automática al entrar a la app: solo corre si la última fue hace más de 6 horas.
     * Si la IA falla, se deja como estaba para reintentar en la próxima visita.
     */
    async autoRefine(userId: string) {
        if (!this.ai.enabled) return { ran: false, refined: 0, usedAi: false };
        const now = new Date();
        const previous = await this.repo.getPrioritizedAt(userId);
        if (!(await this.repo.claimAutoRun(userId, new Date(now.getTime() - AUTO_EVERY_MS), now))) {
            return { ran: false, refined: 0, usedAi: false };
        }
        const { refined, usedAi, failed } = await this.refineWithAi(userId);
        if (failed) await this.repo.setPrioritizedAt(userId, previous); // la IA falló: se reintenta en la próxima visita
        return { ran: true, refined, usedAi };
    }
}
