import { Module } from '@nestjs/common';
import { AiModule } from '../../integrations/ai/ai.module';
import { PriorityModule } from '../priority/priority.module';
import { StudyPlanController } from './study-plan.controller';
import { StudyPlanRepository } from './study-plan.repository';
import { StudyPlanService } from './study-plan.service';

@Module({
    imports: [PriorityModule, AiModule],
    controllers: [StudyPlanController],
    providers: [StudyPlanRepository, StudyPlanService],
    exports: [StudyPlanService],
})
export class StudyPlanModule {}