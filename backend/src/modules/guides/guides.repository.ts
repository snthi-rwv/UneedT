import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StepDraft } from './guide-steps';

// Lo que ve el frontend de un plan específico (sin el texto completo del documento)
const GUIDE_SELECT = {
    id: true, context: true, sourceName: true, summary: true, usedAi: true, updatedAt: true,
    steps: { orderBy: { order: 'asc' } },
} satisfies Prisma.TaskGuideSelect;

const TASK_WITH_GUIDE = { subject: true, guide: { select: GUIDE_SELECT } } satisfies Prisma.TaskInclude;

export interface GuideFields { context: string; sourceName: string | null; sourceText: string | null; summary: string; usedAi: boolean }

// Capa de datos de los planes específicos. Todo filtra por userId.
@Injectable()
export class GuidesRepository {
    constructor(private readonly prisma: PrismaService) {}

    // Tareas abiertas con su plan específico (si tienen), de mayor a menor prioridad
    openTasksWithGuides(userId: string) {
        return this.prisma.task.findMany({
            where: { userId, status: { not: 'DONE' } },
            include: TASK_WITH_GUIDE,
            orderBy: [{ priorityScore: 'desc' }, { dueDate: 'asc' }],
        });
    }
    taskWithGuide(userId: string, taskId: string) {
        return this.prisma.task.findFirst({ where: { id: taskId, userId }, include: TASK_WITH_GUIDE });
    }
    // Incluye el texto del documento: solo para uso interno (armar el prompt)
    findTaskForGuide(userId: string, taskId: string) {
        return this.prisma.task.findFirst({
            where: { id: taskId, userId },
            include: { subject: true, guide: { include: { steps: { orderBy: { order: 'asc' } } } } },
        });
    }
    updateTask(id: string, data: Prisma.TaskUncheckedUpdateInput) { return this.prisma.task.update({ where: { id }, data }); }

    /**
     * Crea o actualiza el plan de la tarea. Los pasos ya hechos se conservan (con su tiempo) y van primero;
     * los pendientes se reemplazan por los nuevos.
     */
    async saveGuide(userId: string, taskId: string, fields: GuideFields, steps: StepDraft[]) {
        const guide = await this.prisma.taskGuide.upsert({ where: { taskId }, create: { taskId, userId, ...fields }, update: fields });
        const kept = await this.prisma.guideStep.findMany({ where: { guideId: guide.id, done: true }, orderBy: { order: 'asc' } });
        await this.prisma.$transaction([
            this.prisma.guideStep.deleteMany({ where: { guideId: guide.id, done: false } }),
            ...kept.map((s, i) => this.prisma.guideStep.update({ where: { id: s.id }, data: { order: i } })),
            this.prisma.guideStep.createMany({ data: steps.map((s, i) => ({ guideId: guide.id, order: kept.length + i, ...s })) }),
        ]);
    }

    findStep(userId: string, stepId: string) {
        return this.prisma.guideStep.findFirst({ where: { id: stepId, guide: { userId } }, include: { guide: { select: { taskId: true } } } });
    }
    updateStep(id: string, data: Prisma.GuideStepUpdateInput) { return this.prisma.guideStep.update({ where: { id }, data }); }
    runningSteps(userId: string) {
        return this.prisma.guideStep.findMany({ where: { runningSince: { not: null }, guide: { userId } } });
    }

    // Suma (o resta) horas dedicadas a la tarea sin dejarlas negativas
    addTaskHours(taskId: string, hours: number) {
        return this.prisma.$transaction([
            this.prisma.task.update({ where: { id: taskId }, data: { hoursSpent: { increment: hours } } }),
            this.prisma.task.updateMany({ where: { id: taskId, hoursSpent: { lt: 0 } }, data: { hoursSpent: 0 } }),
        ]);
    }
    markInProgress(taskId: string) {
        return this.prisma.task.updateMany({ where: { id: taskId, status: 'PENDING' }, data: { status: 'IN_PROGRESS' } });
    }
    taskProgress(taskId: string) {
        return this.prisma.task.findUnique({ where: { id: taskId }, select: { hoursSpent: true, guide: { select: { steps: true } } } });
    }
}
