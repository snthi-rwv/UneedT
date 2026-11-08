import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PriorityService } from '../priority/priority.service';
import { SubjectsRepository } from '../subjects/subjects.repository';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
    constructor(
        private readonly repo: TasksRepository,
        private readonly subjects: SubjectsRepository,
        private readonly priority: PriorityService,
    ) {}

    list(userId: string, filters: { status?: TaskStatus; subjectId?: string }) { return this.repo.list(userId, filters); }

    // Pantalla "Hoy": la tarea #1, las siguientes y contadores de alerta
    async focus(userId: string) {
        await this.priority.recompute(userId); // la urgencia cambia con el paso del tiempo
        const now = new Date();
        const [open, overdue, dueSoon, openCount] = await Promise.all([
            this.repo.topOpen(userId, 7),
            this.repo.countOpen(userId, { lt: now }),
            this.repo.countOpen(userId, { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) }),
            this.repo.countOpen(userId),
        ]);
        return { top: open[0] ?? null, next: open.slice(1), overdue, dueSoon, openCount };
    }

    // Fichas del panel izquierdo: tareas vencidas sin entregar y tareas abiertas (consulta liviana)
    async counts(userId: string) {
        const [overdue, open] = await Promise.all([this.repo.countOpen(userId, { lt: new Date() }), this.repo.countOpen(userId)]);
        return { overdue, open };
    }

    async create(userId: string, dto: CreateTaskDto) {
        if (dto.subjectId) await this.mustOwnSubject(userId, dto.subjectId);
        const task = await this.repo.create({ ...dto, userId });
        await this.priority.recompute(userId);
        return this.get(userId, task.id);
    }

    async get(userId: string, id: string) {
        const task = await this.repo.findOwned(userId, id);
        if (!task) throw new NotFoundException('Tarea no encontrada');
        return task;
    }

    async update(userId: string, id: string, dto: UpdateTaskDto) {
        await this.get(userId, id);
        if (dto.subjectId) await this.mustOwnSubject(userId, dto.subjectId);
        const data: Prisma.TaskUncheckedUpdateInput = { ...dto };
        if (dto.status) data.completedAt = dto.status === 'DONE' ? new Date() : null; // fecha real de entrega
        // Si cambian los datos que usa la prioridad, el ajuste anterior de la IA ya no aplica
        if (['dueDate', 'weightPct', 'complexity', 'estimatedHours', 'subjectId'].some((k) => k in dto)) {
            data.aiAdjustment = 0;
            data.aiReason = null;
        }
        await this.repo.update(id, data);
        await this.priority.recompute(userId);
        return this.get(userId, id);
    }

    async remove(userId: string, id: string) {
        await this.get(userId, id);
        await this.repo.delete(id);
        return { ok: true };
    }

    prioritizeWithAi(userId: string) { return this.priority.refineWithAi(userId); }
    autoPrioritize(userId: string) { return this.priority.autoRefine(userId); } // al entrar: máximo una vez cada 6 h

    private async mustOwnSubject(userId: string, subjectId: string) {
        if (!(await this.subjects.findOwned(userId, subjectId))) throw new BadRequestException('La materia no existe');
    }
}