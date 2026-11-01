import { Injectable, NotFoundException } from '@nestjs/common';
import { AiClient } from '../../integrations/ai/ai.client';
import { PriorityService } from '../priority/priority.service';
import { GeneratePlanDto } from './dto/study-plan.dto';
import { allocateMinutes } from './plan-allocator';
import { PLAN_NOTES_SYSTEM_PROMPT } from './study-plan.prompts';
import { StudyPlanRepository } from './study-plan.repository';

const BREAK_MIN = 10; // descanso entre bloques
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // AAAA-MM-DD
const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

@Injectable()
export class StudyPlanService {
    constructor(
        private readonly repo: StudyPlanRepository,
        private readonly priority: PriorityService,
        private readonly ai: AiClient,
    ) {}

    async generate(userId: string, dto: GeneratePlanDto) {
        const date = dto.date ?? today();
        await this.priority.recompute(userId);
        const tasks = await this.repo.topOpenTasks(userId, 8);

        // 1) Cuántos minutos le toca a cada tarea
        const minutes = allocateMinutes(
            tasks.map((t) => ({ id: t.id, priorityScore: t.priorityScore, pendingMinutes: Math.max(t.estimatedHours - t.hoursSpent, 0.25) * 60 })),
            Math.round(dto.availableHours * 60),
        );
        const items = tasks.filter((t) => minutes.has(t.id));

        // 2) Una indicación corta por bloque (IA, con plan B)
        const notes = await this.buildNotes(
            items.map((t) => ({ id: t.id, title: t.title, subject: t.subject?.name, minutes: minutes.get(t.id), reason: t.priorityReason })),
        );

        // 3) Horas de inicio consecutivas
        const [h, m] = (dto.startTime ?? '08:00').split(':').map(Number);
        let cursor = h * 60 + m;
        const blocks = items.map((t, order) => {
            const block = {
                taskId: t.id,
                order,
                startTime: hhmm(cursor),
                minutes: minutes.get(t.id)!,
                note: notes[t.id] ?? `${t.priorityReason} Avanza lo que puedas de "${t.title}".`,
            };
            cursor += block.minutes + BREAK_MIN;
            return block;
        });

        await this.repo.replacePlan(userId, date, dto.availableHours, blocks);
        return this.repo.findByDate(userId, date);
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
            await this.repo.setBlockDone(block.id, block.taskId, done, block.minutes / 60);
            await this.priority.recompute(userId); // menos horas pendientes = otra prioridad
        }
        return { ok: true };
    }
}