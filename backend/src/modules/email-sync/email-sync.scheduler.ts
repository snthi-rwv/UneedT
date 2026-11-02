import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailAccountsRepository } from './email-accounts.repository';
import { EmailSyncService } from './email-sync.service';

// Tarea programada: cada 30 minutos revisa el correo de todos los usuarios conectados.
@Injectable()
export class EmailSyncScheduler {
    private readonly log = new Logger(EmailSyncScheduler.name);
    constructor(private readonly accounts: EmailAccountsRepository, private readonly sync: EmailSyncService) {}

    @Cron(CronExpression.EVERY_30_MINUTES)
    async run() {
        for (const a of await this.accounts.listActive()) {
            await this.sync.syncUser(a.userId).catch((e) => this.log.error(`Sync falló para ${a.userId}: ${e.message}`)); // uno que falle no frena a los demás
        }
    }
}