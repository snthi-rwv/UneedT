import { Injectable } from '@nestjs/common';
import { SurveyKind } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de las encuestas de agobio.
@Injectable()
export class SurveysRepository {
    constructor(private readonly prisma: PrismaService) {}

    count(userId: string) { return this.prisma.survey.count({ where: { userId } }); }
    create(userId: string, score: number, kind: SurveyKind) { return this.prisma.survey.create({ data: { userId, score, kind } }); }
    list(userId: string) { return this.prisma.survey.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }); }
}