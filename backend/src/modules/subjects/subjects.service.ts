import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PriorityService } from '../priority/priority.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { SubjectsRepository } from './subjects.repository';

@Injectable()
export class SubjectsService {
    constructor(private readonly repo: SubjectsRepository, private readonly priority: PriorityService) {}

    list(userId: string) { return this.repo.list(userId); }

    async create(userId: string, dto: CreateSubjectDto) {
        try { return await this.repo.create(userId, dto); }
        catch { throw new ConflictException('Ya tienes una materia con ese nombre'); }
    }

    async update(userId: string, id: string, dto: UpdateSubjectDto) {
        await this.mustOwn(userId, id);
        const subject = await this.repo.update(id, dto);
        await this.priority.recompute(userId); // dificultad y nota actual cambian las prioridades
        return subject;
    }

    async remove(userId: string, id: string) {
        await this.mustOwn(userId, id);
        await this.repo.delete(id);
        await this.priority.recompute(userId);
        return { ok: true };
    }

    private async mustOwn(userId: string, id: string) {
        if (!(await this.repo.findOwned(userId, id))) throw new NotFoundException('Materia no encontrada');
    }
}