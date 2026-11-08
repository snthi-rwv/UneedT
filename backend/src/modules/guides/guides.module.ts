import { Module } from '@nestjs/common';
import { AiModule } from '../../integrations/ai/ai.module';
import { DocumentsModule } from '../../integrations/documents/documents.module';
import { ActivityModule } from '../activity/activity.module';
import { PriorityModule } from '../priority/priority.module';
import { StudyPlanModule } from '../study-plan/study-plan.module';
import { GuidesController } from './guides.controller';
import { GuidesRepository } from './guides.repository';
import { GuidesService } from './guides.service';

// Planes específicos por tarea: contexto del estudiante, paso a paso con IA y cronómetro por paso
@Module({
    imports: [AiModule, DocumentsModule, PriorityModule, StudyPlanModule, ActivityModule],
    controllers: [GuidesController],
    providers: [GuidesRepository, GuidesService],
})
export class GuidesModule {}
