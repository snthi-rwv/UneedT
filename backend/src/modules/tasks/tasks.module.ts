import { Module } from '@nestjs/common';
import { PriorityModule } from '../priority/priority.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
    imports: [PriorityModule, SubjectsModule],
    controllers: [TasksController],
    providers: [TasksRepository, TasksService],
    exports: [TasksRepository],
})
export class TasksModule {}