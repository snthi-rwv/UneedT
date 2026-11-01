import { Injectable } from '@nestjs/common';
import { CRITICAL_THRESHOLD, scoreTask } from './priority.calculator';
import { PriorityRepository } from './priority.repository';

@Injectable()
export class PriorityService {
    constructor(private readonly repo: PriorityRepository) {}

    /** Recalcula el puntaje base de todas las tareas abiertas (sin IA). */
    async recompute(userId: string) {
        const now = new Date();
        const open = await this.repo.openTasks(userId);
        await this.repo.saveScores(open.map((t) => {
            const { score, reason } = scoreTask(t, t.subject, now);
            return { id: t.id, priorityScore: score, priorityReason: reason, critical: score >= CRITICAL_THRESHOLD };
        }));
    }
}