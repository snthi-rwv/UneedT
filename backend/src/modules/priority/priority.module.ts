import { Module } from '@nestjs/common';
import { AiModule } from '../../integrations/ai/ai.module';
import { PriorityRepository } from './priority.repository';
import { PriorityService } from './priority.service';

@Module({ imports: [AiModule], providers: [PriorityRepository, PriorityService], exports: [PriorityService] })
export class PriorityModule {}