import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ScoreUpdate { id: string; priorityScore: number; priorityReason: string; critical: boolean }
export interface AiUpdate { id: string; aiAdjustment: number; aiReason: string | null }

// Capa de datos de la priorización (lee/escribe puntajes de tareas abiertas y la marca de la última repriorización).
@Injectable()
export class PriorityRepository {
    constructor(private readonly prisma: PrismaService) {}

    openTasks(userId: string) {
        return this.prisma.task.findMany({ where: { userId, status: { not: 'DONE' } }, include: { subject: true } });
    }
    saveScores(updates: ScoreUpdate[]) {
        return this.prisma.$transaction(updates.map(({ id, ...data }) => this.prisma.task.update({ where: { id }, data })));
    }
    saveAiAdjustments(updates: AiUpdate[]) {
        return this.prisma.$transaction(updates.map(({ id, ...data }) => this.prisma.task.update({ where: { id }, data })));
    }

    async getPrioritizedAt(userId: string) {
        return (await this.prisma.user.findUnique({ where: { id: userId }, select: { aiPrioritizedAt: true } }))?.aiPrioritizedAt ?? null;
    }
    setPrioritizedAt(userId: string, at: Date | null) {
        return this.prisma.user.update({ where: { id: userId }, data: { aiPrioritizedAt: at } });
    }

    /**
     * Reserva la repriorización automática de forma atómica: solo una petición la gana aunque lleguen dos a la vez.
     * Devuelve true si la última fue antes de `olderThan` (o nunca hubo una).
     */
    async claimAutoRun(userId: string, olderThan: Date, now: Date) {
        const r = await this.prisma.user.updateMany({
            where: { id: userId, OR: [{ aiPrioritizedAt: null }, { aiPrioritizedAt: { lt: olderThan } }] },
            data: { aiPrioritizedAt: now },
        });
        return r.count === 1;
    }
}
