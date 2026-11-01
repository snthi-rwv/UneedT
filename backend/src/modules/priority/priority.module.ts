import { Module } from '@nestjs/common';
import { PriorityRepository } from './priority.repository';
import { PriorityService } from './priority.service';

@Module({ providers: [PriorityRepository, PriorityService], exports: [PriorityService] })
export class PriorityModule {}