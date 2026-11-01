import { Module } from '@nestjs/common';
import { PriorityModule } from '../priority/priority.module';
import { SubjectsController } from './subjects.controller';
import { SubjectsRepository } from './subjects.repository';
import { SubjectsService } from './subjects.service';

@Module({
    imports: [PriorityModule],
    controllers: [SubjectsController],
    providers: [SubjectsRepository, SubjectsService],
    exports: [SubjectsRepository],
})
export class SubjectsModule {}