import { Injectable, NotFoundException } from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { PriorityService } from '../priority/priority.service';
import { SubjectsRepository } from '../subjects/subjects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { AcceptProposalDto } from './dto/proposal.dto';
import { EmailSyncRepository } from './email-sync.repository';

// Quita tildes y mayúsculas para comparar nombres de materia
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Panel de confirmación: el estudiante acepta o descarta lo que propuso la IA. */
@Injectable()
export class ProposalsService {
    constructor(
        private readonly repo: EmailSyncRepository,
        private readonly subjects: SubjectsRepository,
        private readonly tasks: TasksRepository,
        private readonly priority: PriorityService,
    ) {}

    list(userId: string, status: ProposalStatus = 'PENDING') { return this.repo.listProposals(userId, status); }

    async accept(userId: string, id: string, edits: AcceptProposalDto) {
        const p = await this.repo.findPendingProposal(userId, id);
        if (!p) throw new NotFoundException('Propuesta no encontrada o ya resuelta');

        // Busca la materia por nombre parecido; si no existe, la crea
        let subjectId: string | null = null;
        const hint = (edits.subjectName ?? p.subjectHint)?.trim();
        if (hint) {
            const existing = (await this.subjects.list(userId)).find((s) => norm(s.name).includes(norm(hint)) || norm(hint).includes(norm(s.name)));
            subjectId = existing?.id ?? (await this.subjects.create(userId, { name: hint.slice(0, 80) })).id;
        }

        const task = await this.tasks.create({
            userId,
            subjectId,
            source: 'EMAIL',
            title: edits.title ?? p.title,
            description: p.description,
            dueDate: edits.dueDate ?? p.dueDate ?? new Date(Date.now() + 7 * 86_400_000), // sin fecha: una semana
            weightPct: edits.weightPct ?? p.weightPct ?? 10,
            complexity: edits.complexity ?? p.complexity ?? 3,
            estimatedHours: edits.estimatedHours ?? p.estimatedHours ?? 2,
        });
        await this.repo.setProposalStatus(id, 'ACCEPTED');
        await this.priority.recompute(userId);
        return task;
    }

    async reject(userId: string, id: string) {
        const r = await this.repo.rejectPending(userId, id);
        if (!r.count) throw new NotFoundException('Propuesta no encontrada o ya resuelta');
        return { ok: true };
    }
}