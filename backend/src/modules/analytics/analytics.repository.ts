import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de las métricas (solo lectura).
@Injectable()
export class AnalyticsRepository {
    constructor(private readonly prisma: PrismaService) {}

    tasks(userId: string) { return this.prisma.task.findMany({ where: { userId } }); }
    surveys(userId: string) { return this.prisma.survey.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }); }
}