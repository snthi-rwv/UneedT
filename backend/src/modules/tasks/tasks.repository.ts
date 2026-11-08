import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de tareas. Todas las consultas filtran por userId.
@Injectable()
export class TasksRepository {
    constructor(private readonly prisma: PrismaService) {}

    list(userId: string, f: { status?: TaskStatus; subjectId?: string }) {
        return this.prisma.task.findMany({
            where: { userId, ...(f.status && { status: f.status }), ...(f.subjectId && { subjectId: f.subjectId }) },
            include: { subject: true },
            orderBy: [{ status: 'asc' }, { priorityScore: 'desc' }, { dueDate: 'asc' }],
        });
    }
    findOwned(userId: string, id: string) { return this.prisma.task.findFirst({ where: { id, userId }, include: { subject: true } }); }
    create(data: Prisma.TaskUncheckedCreateInput) { return this.prisma.task.create({ data }); }
    update(id: string, data: Prisma.TaskUncheckedUpdateInput) { return this.prisma.task.update({ where: { id }, data }); }
    delete(id: string) { return this.prisma.task.delete({ where: { id } }); }

    // Datos de la página principal (incluye si la tarea ya tiene plan específico)
    topOpen(userId: string, take: number) {
        return this.prisma.task.findMany({
            where: { userId, status: { not: 'DONE' } },
            include: { subject: true, guide: { select: { id: true } } },
            orderBy: [{ priorityScore: 'desc' }, { dueDate: 'asc' }],
            take,
        });
    }
    countOpen(userId: string, dueRange?: { gte?: Date; lt?: Date; lte?: Date }) {
        return this.prisma.task.count({ where: { userId, status: { not: 'DONE' }, ...(dueRange && { dueDate: dueRange }) } });
    }
}