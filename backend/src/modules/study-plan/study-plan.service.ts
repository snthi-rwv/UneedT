import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanIntensity } from '@prisma/client';
import { AiClient } from '../../integrations/ai/ai.client';
import { ActivityService } from '../activity/activity.service';
import { PriorityService } from '../priority/priority.service';
import { GeneratePlanDto } from './dto/study-plan.dto';
import { allocateMinutes } from './plan-allocator';
import { bogotaNowMinutes, hhmm, INTENSITY, schedule, studyMinutesInWindow, toMin } from './plan-schedule';
import { PLAN_NOTES_SYSTEM_PROMPT } from './study-plan.prompts';
import { NewBlock, StudyPlanRepository } from './study-plan.repository';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // AAAA-MM-DD
type OpenTask = Awaited<ReturnType<StudyPlanRepository['topOpenTasks']>>[number];

@Injectable()
export class StudyPlanService {
    constructor(
        private readonly repo: StudyPlanRepository,
        private readonly priority: PriorityService,
        private readonly ai: AiClient,
        private readonly activity: ActivityService,
    ) {}

    /** Arma el plan del día desde cero: reparte las horas según la prioridad y la intensidad elegida. */
    async generate(userId: string, dto: GeneratePlanDto) {
        const date = dto.date ?? today();
        const intensity = dto.intensity ?? 'NORMAL';
        const startTime = dto.startTime ?? '08:00';

        const tasks = await this.candidates(userId);
        const layout = this.layout(tasks, Math.round(dto.availableHours * 60), toMin(startTime), intensity);
        const blocks = await this.withNotes(tasks, layout.slots, {}, 0);

        await this.repo.replacePlan(userId, date, { availableHours: dto.availableHours, startTime, endTime: hhmm(layout.endMin), intensity }, blocks);
        return this.repo.findByDate(userId, date);
    }

    /**
     * Replantea el plan con el tiempo que queda: conserva los bloques ya hechos y vuelve a repartir
     * el resto según las prioridades y estimaciones actuales (que ya incluyen el ritmo real del estudiante).
     * Si el plan es de hoy, solo usa el tiempo desde ahora hasta la hora en que terminaba el plan.
     */
    async replan(userId: string, date = today()) {
        const plan = await this.repo.findByDate(userId, date);
        if (!plan) throw new NotFoundException('No hay plan para este día. Ármalo primero.');

        const planStart = toMin(plan.startTime);
        const { block, rest } = INTENSITY[plan.intensity];
        const done = plan.blocks.filter((b) => b.done);
        let planEnd = plan.endTime ? toMin(plan.endTime) : planStart + Math.round(plan.availableHours * 60 * (block + rest) / block);
        if (planEnd <= planStart) planEnd += 24 * 60; // el plan termina después de medianoche
        const from = date === today() ? Math.max(planStart, Math.ceil(bogotaNowMinutes() / 5) * 5) : planStart;
        const studied = done.reduce((n, b) => n + b.minutes, 0);
        let budget = Math.min(Math.round(plan.availableHours * 60) - studied, studyMinutesInWindow(planEnd - from, plan.intensity));
        if (budget < 15) {
            throw new BadRequestException('Ya no queda tiempo en el plan de este día. Ármalo de nuevo con más horas o para otro día.');
        }

        const tasks = await this.candidates(userId);
        // El reparto exacto depende de cómo caen los bloques; se ajusta hasta que quepa en la ventana
        let layout = this.layout(tasks, budget, from, plan.intensity);
        while (layout.endMin > planEnd && budget > 15) {
            budget -= 15;
            layout = this.layout(tasks, budget, from, plan.intensity);
        }
        const knownNotes = Object.fromEntries(plan.blocks.map((b) => [b.taskId, b.note]));
        const blocks = await this.withNotes(tasks, layout.slots, knownNotes, done.length);

        await this.repo.replaceUndoneBlocks(plan.id, blocks);
        return this.repo.findByDate(userId, date);
    }

    /** Usado al añadir contexto a una tarea: si hay plan para hoy, se recalcula. Nunca rompe el flujo que lo llama. */
    async replanTodayIfExists(userId: string) {
        try {
            if (!(await this.repo.findByDate(userId, today()))) return false;
            await this.replan(userId);
            return true;
        } catch {
            return false;
        }
    }

    private async candidates(userId: string) {
        await this.priority.recompute(userId);
        return this.repo.topOpenTasks(userId, 8);
    }

    // Cuántos minutos le tocan a cada tarea y cómo quedan los bloques en el horario
    private layout(tasks: OpenTask[], budget: number, startMin: number, intensity: PlanIntensity) {
        const minutes = allocateMinutes(
            tasks.map((t) => ({ id: t.id, priorityScore: t.priorityScore, pendingMinutes: Math.max(t.estimatedHours - t.hoursSpent, 0.25) * 60 })),
            budget,
        );
        const items = tasks.filter((t) => minutes.has(t.id)).map((t) => ({ taskId: t.id, minutes: minutes.get(t.id)! }));
        return schedule(items, startMin, intensity);
    }

    // Una indicación corta por tarea (IA, con plan B). Las tareas que ya tenían indicación la conservan.
    private async withNotes(tasks: OpenTask[], slots: ReturnType<typeof schedule>['slots'], known: Record<string, string>, orderFrom: number): Promise<NewBlock[]> {
        const byId = new Map(tasks.map((t) => [t.id, t]));
        const minutesByTask = new Map<string, number>();
        for (const s of slots) minutesByTask.set(s.taskId, (minutesByTask.get(s.taskId) ?? 0) + s.minutes);

        const missing = [...minutesByTask.keys()].filter((id) => !known[id]).map((id) => byId.get(id)!);
        const notes = { ...known, ...(await this.buildNotes(missing.map((t) => ({ id: t.id, title: t.title, subject: t.subject?.name, minutes: minutesByTask.get(t.id), reason: t.priorityReason })))) };

        return slots.map((s, i) => {
            const t = byId.get(s.taskId)!;
            return { ...s, order: orderFrom + i, note: notes[s.taskId] ?? `${t.priorityReason} Avanza lo que puedas de "${t.title}".` };
        });
    }

    private async buildNotes(items: object[]): Promise<Record<string, string>> {
        if (!items.length) return {};
        const out = await this.ai.completeJson<{ id: string; note: string }[]>(PLAN_NOTES_SYSTEM_PROMPT, JSON.stringify(items), 2000);
        const map: Record<string, string> = {};
        if (Array.isArray(out)) for (const o of out) if (o?.id && o?.note) map[o.id] = String(o.note).slice(0, 200);
        return map;
    }

    getByDate(userId: string, date = today()) { return this.repo.findByDate(userId, date); } // null si aún no hay plan

    async setBlockDone(userId: string, blockId: string, done: boolean) {
        const block = await this.repo.findBlock(userId, blockId);
        if (!block) throw new NotFoundException('Bloque no encontrado');
        if (block.done !== done) {
            // Si la tarea tiene pasos, las horas ya las suman los pasos: el bloque no las cuenta otra vez
            const hours = (await this.repo.hasGuide(block.taskId)) ? 0 : block.minutes / 60;
            await this.repo.setBlockDone(block.id, block.taskId, done, hours);
            if (hours) await this.activity.log(userId, (done ? 1 : -1) * block.minutes * 60); // cuenta para la racha
            await this.priority.recompute(userId); // menos horas pendientes = otra prioridad
        }
        return { ok: true };
    }
}
