import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PriorityService } from '../priority/priority.service';
import { SaveGradesDto } from './dto/grades.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { gradeSummary } from './grades.calc';
import { SubjectsRepository } from './subjects.repository';

@Injectable()
export class SubjectsService {
    constructor(private readonly repo: SubjectsRepository, private readonly priority: PriorityService) {}

    // Cada materia trae el resumen de sus notas (promedio, % evaluado, cuánto necesita)
    async list(userId: string) {
        return (await this.repo.list(userId)).map(({ grades, ...s }) => ({ ...s, gradesCount: grades.length, summary: gradeSummary(grades, s.targetGrade) }));
    }

    async create(userId: string, dto: CreateSubjectDto) {
        try { return await this.repo.create(userId, dto); }
        catch { throw new ConflictException('Ya tienes una materia con ese nombre'); }
    }

    async update(userId: string, id: string, dto: UpdateSubjectDto) {
        await this.mustOwn(userId, id);
        // Si la materia tiene notas registradas, la nota actual se calcula sola: la manual se ignora
        if ('currentGrade' in dto && (await this.repo.countGrades(id))) delete dto.currentGrade;
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

    async getGrades(userId: string, id: string) {
        const subject = await this.mustOwn(userId, id);
        const entries = await this.repo.grades(id);
        return { subjectId: id, targetGrade: subject.targetGrade, entries, summary: gradeSummary(entries, subject.targetGrade) };
    }

    /** "Validar": guarda las notas, calcula el promedio y recalcula la prioridad de las tareas de la materia. */
    async saveGrades(userId: string, id: string, dto: SaveGradesDto) {
        const subject = await this.mustOwn(userId, id);
        const total = dto.entries.reduce((n, e) => n + e.percent, 0);
        if (total > 100.0001) throw new BadRequestException(`Los porcentajes suman ${Math.round(total * 100) / 100} %. No pueden pasar de 100 %.`);

        const entries = dto.entries.map((e) => ({ label: (e.label ?? '').trim().slice(0, 60), percent: e.percent, grade: e.grade }));
        const target = dto.targetGrade ?? subject.targetGrade;
        const summary = gradeSummary(entries, target);
        // La nota actual de la materia pasa a ser el promedio de lo evaluado (la usa la prioridad y la IA)
        await this.repo.saveGrades(id, entries, { targetGrade: target, currentGrade: summary.average });
        await this.priority.recompute(userId);
        return this.getGrades(userId, id);
    }

    private async mustOwn(userId: string, id: string) {
        const s = await this.repo.findOwned(userId, id);
        if (!s) throw new NotFoundException('Materia no encontrada');
        return s;
    }
}