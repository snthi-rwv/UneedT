import { Injectable } from '@nestjs/common';
import { Prisma, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de la sincronización: bitácora, correos ya leídos y propuestas.
@Injectable()
export class EmailSyncRepository {
    constructor(private readonly prisma: PrismaService) {}

    startLog(userId: string) { return this.prisma.emailSyncLog.create({ data: { userId } }); }
    finishLog(id: string, data: { ok?: boolean; fetched?: number; proposed?: number; error?: string }) {
        return this.prisma.emailSyncLog.update({ where: { id }, data: { ...data, finishedAt: new Date() } });
    }
    lastLog(userId: string) { return this.prisma.emailSyncLog.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' } }); }

    async processedIds(userId: string, ids: string[]) {
        const rows = await this.prisma.processedEmail.findMany({ where: { userId, messageId: { in: ids } }, select: { messageId: true } });
        return new Set(rows.map((r) => r.messageId));
    }
    markProcessed(userId: string, ids: string[]) {
        return this.prisma.processedEmail.createMany({ data: ids.map((messageId) => ({ userId, messageId })), skipDuplicates: true });
    }

    createProposal(data: Prisma.TaskProposalUncheckedCreateInput) { return this.prisma.taskProposal.create({ data }); }
    listProposals(userId: string, status: ProposalStatus) {
        return this.prisma.taskProposal.findMany({ where: { userId, status }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] });
    }
    findPendingProposal(userId: string, id: string) { return this.prisma.taskProposal.findFirst({ where: { id, userId, status: 'PENDING' } }); }
    setProposalStatus(id: string, status: ProposalStatus) { return this.prisma.taskProposal.update({ where: { id }, data: { status } }); }
    rejectPending(userId: string, id: string) {
        return this.prisma.taskProposal.updateMany({ where: { id, userId, status: 'PENDING' }, data: { status: 'REJECTED' } });
    }
    countPending(userId: string) { return this.prisma.taskProposal.count({ where: { userId, status: 'PENDING' } }); }
}