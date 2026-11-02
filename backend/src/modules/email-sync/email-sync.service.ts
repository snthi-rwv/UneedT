import { Injectable, NotFoundException } from '@nestjs/common';
import { AiClient } from '../../integrations/ai/ai.client';
import { GmailClient, RawEmail } from '../../integrations/google/gmail.client';
import { EmailAccountsRepository } from './email-accounts.repository';
import { EmailAccountsService } from './email-accounts.service';
import { EmailExtractorService, ExtractedTask } from './email-extractor.service';
import { EmailSyncRepository } from './email-sync.repository';

// Deja un número dentro de un rango, o null si no es válido
const bounded = (v: unknown, min: number, max: number) =>
    v != null && Number.isFinite(Number(v)) ? Math.min(Math.max(Number(v), min), max) : null;
const BATCH = 3; // correos por llamada a la IA (pequeño: los planes gratis limitan los tokens por minuto)

/** Orquesta la sincronización: Gmail → IA → propuestas pendientes de confirmar. */
@Injectable()
export class EmailSyncService {
    constructor(
        private readonly accounts: EmailAccountsService,
        private readonly accountsRepo: EmailAccountsRepository,
        private readonly repo: EmailSyncRepository,
        private readonly gmail: GmailClient,
        private readonly extractor: EmailExtractorService,
        private readonly ai: AiClient,
    ) {}

    async status(userId: string) {
        const [account, lastLog, pending] = await Promise.all([
            this.accounts.find(userId), this.repo.lastLog(userId), this.repo.countPending(userId),
        ]);
        return {
            connected: account?.status === 'ACTIVE',
            pending,
            aiEnabled: this.ai.enabled,
            lastLog,
            account: account && { email: account.email, status: account.status, lastSyncAt: account.lastSyncAt }, // el token nunca sale
        };
    }

    async syncUser(userId: string) {
        const account = await this.accounts.find(userId);
        if (!account || account.status !== 'ACTIVE') throw new NotFoundException('No hay un correo conectado');
        const log = await this.repo.startLog(userId);
        try {
            const session = this.gmail.open(this.accounts.refreshTokenOf(account));
            // Desde la última revisión (entre 1 y 14 días); la primera vez, 7 días
            const days = account.lastSyncAt
                ? Math.min(Math.max(Math.ceil((Date.now() - account.lastSyncAt.getTime()) / 86_400_000), 1), 14)
                : 7;

            const ids = await session.listRecentIds(days);
            const done = await this.repo.processedIds(userId, ids);
            const emails = await session.getMessages(ids.filter((id) => !done.has(id)));

            let proposed = 0;
            for (let i = 0; i < emails.length; i += BATCH) proposed += await this.processBatch(userId, emails.slice(i, i + BATCH));

            await this.accountsRepo.touch(userId);
            await this.repo.finishLog(log.id, { ok: true, fetched: emails.length, proposed });
            return { fetched: emails.length, proposed };
        } catch (e: any) {
            // Si Google revocó el permiso, se marca para pedirle al usuario que reconecte
            if (/invalid_grant|unauthorized_client/i.test(String(e?.message))) await this.accountsRepo.markRevoked(userId);
            await this.repo.finishLog(log.id, { error: String(e?.message).slice(0, 400) });
            throw e;
        }
    }

    // Un lote de correos: IA → propuestas guardadas → correos marcados como leídos
    private async processBatch(userId: string, batch: RawEmail[]): Promise<number> {
        const extracted = await this.extractor.extract(batch);
        if (!extracted) return 0; // IA no disponible: no se marcan como leídos para reintentar después

        const byId = new Map(batch.map((e) => [e.id, e]));
        let created = 0;
        for (const x of extracted) {
            const email = byId.get(x?.messageId);
            if (email && (await this.saveProposal(userId, email, x))) created++;
        }
        await this.repo.markProcessed(userId, batch.map((e) => e.id));
        return created;
    }

    private async saveProposal(userId: string, e: RawEmail, x: ExtractedTask): Promise<boolean> {
        if (!x.isTask || !x.title || (x.confidence ?? 0) < 0.5) return false; // baja confianza: se ignora
        const due = x.dueDate ? new Date(x.dueDate) : null;
        const complexity = bounded(x.complexity, 1, 5);
        try {
            await this.repo.createProposal({
                userId,
                messageId: e.id,
                fromAddress: e.from.slice(0, 200),
                emailSubject: e.subject.slice(0, 200),
                snippet: e.snippet.slice(0, 400),
                subjectHint: x.subjectHint?.slice(0, 80) ?? null,
                title: String(x.title).slice(0, 160),
                description: x.description?.slice(0, 600) ?? null,
                dueDate: due && !isNaN(due.getTime()) ? due : null,
                weightPct: bounded(x.weightPct, 0, 100),
                complexity: complexity && Math.round(complexity),
                estimatedHours: bounded(x.estimatedHours, 0.25, 100),
                confidence: bounded(x.confidence, 0, 1) ?? 0.5,
            });
            return true;
        } catch {
            return false; // propuesta repetida (misma tarea del mismo correo)
        }
    }

    disconnect(userId: string) { return this.accounts.disconnect(userId).then(() => ({ ok: true })); }
}