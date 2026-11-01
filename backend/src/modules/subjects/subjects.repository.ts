import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de materias. Todas las consultas filtran por userId (aislamiento entre usuarios).
@Injectable()
export class SubjectsRepository {
    constructor(private readonly prisma: PrismaService) {}

    list(userId: string) {
        return this.prisma.subject.findMany({ where: { userId }, orderBy: { name: 'asc' }, include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } } } });
    }
    findOwned(userId: string, id: string) { return this.prisma.subject.findFirst({ where: { id, userId } }); }
    create(userId: string, data: Omit<Prisma.SubjectUncheckedCreateInput, 'userId'>) { return this.prisma.subject.create({ data: { ...data, userId } }); }
    update(id: string, data: Prisma.SubjectUpdateInput) { return this.prisma.subject.update({ where: { id }, data }); }
    delete(id: string) { return this.prisma.subject.delete({ where: { id } }); }
}