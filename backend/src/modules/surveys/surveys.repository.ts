import { Injectable } from '@nestjs/common';
import { SurveyKind } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface SurveyAnswers { score: number; concentration?: number; performance?: number }

// Capa de datos de la encuesta diaria (agobio, concentración y rendimiento).
@Injectable()
export class SurveysRepository {
    constructor(private readonly prisma: PrismaService) {}

    count(userId: string) { return this.prisma.survey.count({ where: { userId } }); }
    create(userId: string, a: SurveyAnswers, kind: SurveyKind) { return this.prisma.survey.create({ data: { userId, ...a, kind } }); }
    update(id: string, a: SurveyAnswers) { return this.prisma.survey.update({ where: { id }, data: a }); }
    latest(userId: string) { return this.prisma.survey.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
    list(userId: string) { return this.prisma.survey.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }); }
}
