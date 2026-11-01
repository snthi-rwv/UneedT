import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ScoreUpdate { id: string; priorityScore: number; priorityReason: string; critical: boolean }

// Capa de datos de la priorización (solo lee/escribe puntajes de tareas abiertas).
@Injectable()
export class PriorityRepository {
    constructor(private readonly prisma: PrismaService) {}

    openTasks(userId: string) {
        return this.prisma.task.findMany({ where: { userId, status: { not: 'DONE' } }, include: { subject: true } });
    }
    topOpenTasks(userId: string, take: number) {
        return this.prisma.task.findMany({
            where: { userId, status: { not: 'DONE' } },
            include: { subject: true },
            orderBy: { priorityScore: 'desc' },
            take,
        });
    }
    saveScores(updates: ScoreUpdate[]) {
        return this.prisma.$transaction(updates.map(({ id, ...data }) => this.prisma.task.update({ where: { id }, data })));
    }
}