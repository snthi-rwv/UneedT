import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de materias. Todas las consultas filtran por userId (aislamiento entre usuarios).
@Injectable()
export class SubjectsRepository {
    constructor(private readonly prisma: PrismaService) {}

    list(userId: string) {
        return this.prisma.subject.findMany({
            where: { userId },
            orderBy: { name: 'asc' },
            include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } }, grades: { orderBy: { order: 'asc' } } },
        });
    }
    findOwned(userId: string, id: string) { return this.prisma.subject.findFirst({ where: { id, userId } }); }
    create(userId: string, data: Omit<Prisma.SubjectUncheckedCreateInput, 'userId'>) { return this.prisma.subject.create({ data: { ...data, userId } }); }
    update(id: string, data: Prisma.SubjectUpdateInput) { return this.prisma.subject.update({ where: { id }, data }); }
    delete(id: string) { return this.prisma.subject.delete({ where: { id } }); }

    grades(subjectId: string) { return this.prisma.gradeEntry.findMany({ where: { subjectId }, orderBy: { order: 'asc' } }); }
    countGrades(subjectId: string) { return this.prisma.gradeEntry.count({ where: { subjectId } }); }

    // "Validar": reemplaza todas las notas y guarda la meta y el promedio en una sola transacción
    saveGrades(subjectId: string, entries: { label: string; percent: number; grade: number }[], data: Prisma.SubjectUpdateInput) {
        return this.prisma.$transaction([
            this.prisma.gradeEntry.deleteMany({ where: { subjectId } }),
            this.prisma.gradeEntry.createMany({ data: entries.map((e, order) => ({ ...e, order, subjectId })) }),
            this.prisma.subject.update({ where: { id: subjectId }, data }),
        ]);
    }
}