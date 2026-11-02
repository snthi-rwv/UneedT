import { Module } from '@nestjs/common';
import { AiModule } from '../../integrations/ai/ai.module';
import { GoogleModule } from '../../integrations/google/google.module';
import { PriorityModule } from '../priority/priority.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TasksModule } from '../tasks/tasks.module';
import { EmailAccountsRepository } from './email-accounts.repository';
import { EmailAccountsService } from './email-accounts.service';
import { EmailExtractorService } from './email-extractor.service';
import { EmailSyncController } from './email-sync.controller';
import { EmailSyncRepository } from './email-sync.repository';
import { EmailSyncScheduler } from './email-sync.scheduler';
import { EmailSyncService } from './email-sync.service';
import { ProposalsService } from './proposals.service';

@Module({
    imports: [GoogleModule, AiModule, PriorityModule, SubjectsModule, TasksModule],
    controllers: [EmailSyncController],
    providers: [
        EmailAccountsRepository, EmailAccountsService, EmailSyncRepository,
        EmailExtractorService, EmailSyncService, ProposalsService, EmailSyncScheduler,
    ],
    exports: [EmailAccountsService, EmailSyncService],
})
export class EmailSyncModule {}