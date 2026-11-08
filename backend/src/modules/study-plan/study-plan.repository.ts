import { Injectable } from '@nestjs/common';
import { PlanIntensity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface NewBlock { taskId: string; order: number; startTime: string; minutes: number; note: string }
export interface PlanMeta { availableHours: number; startTime: string; endTime: string; intensity: PlanIntensity }

// Capa de datos del plan de estudio.
@Injectable()
export class StudyPlanRepository {
    constructor(private readonly prisma: PrismaService) {}

    topOpenTasks(userId: string, take: number) {
        return this.prisma.task.findMany({
            where: { userId, status: { not: 'DONE' } },
            include: { subject: true },
            orderBy: { priorityScore: 'desc' },
            take,
        });
    }

    findByDate(userId: string, date: string) {
        return this.prisma.studyPlan.findUnique({
            where: { userId_date: { userId, date } },
            include: { blocks: { orderBy: { order: 'asc' }, include: { task: { include: { subject: true } } } } },
        });
    }

    // Un solo plan por día: si ya existía, se reemplaza
    async replacePlan(userId: string, date: string, meta: PlanMeta, blocks: NewBlock[]) {
        await this.prisma.studyPlan.deleteMany({ where: { userId, date } });
        return this.prisma.studyPlan.create({ data: { userId, date, ...meta, blocks: { create: blocks } } });
    }

    // Replanteo: los bloques ya hechos se conservan; los pendientes se reemplazan
    replaceUndoneBlocks(planId: string, blocks: NewBlock[]) {
        return this.prisma.$transaction([
            this.prisma.studyBlock.deleteMany({ where: { planId, done: false } }),
            this.prisma.studyBlock.createMany({ data: blocks.map((b) => ({ ...b, planId })) }),
        ]);
    }

    findBlock(userId: string, blockId: string) {
        return this.prisma.studyBlock.findFirst({ where: { id: blockId, plan: { userId } } });
    }

    async hasGuide(taskId: string) {
        return (await this.prisma.taskGuide.count({ where: { taskId } })) > 0;
    }

    // Marca el bloque y suma/resta las horas estudiadas en la tarea (todo o nada)
    setBlockDone(blockId: string, taskId: string, done: boolean, hours: number) {
        return this.prisma.$transaction([
            this.prisma.studyBlock.update({ where: { id: blockId }, data: { done } }),
            this.prisma.task.update({ where: { id: taskId }, data: { hoursSpent: { increment: done ? hours : -hours } } }),
            this.prisma.task.updateMany({ where: { id: taskId, hoursSpent: { lt: 0 } }, data: { hoursSpent: 0 } }),
            this.prisma.task.updateMany({ where: { id: taskId, status: 'PENDING' }, data: { status: done ? 'IN_PROGRESS' : 'PENDING' } }),
        ]);
    }
}
