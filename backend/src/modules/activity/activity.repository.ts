import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos del tiempo estudiado por día.
@Injectable()
export class ActivityRepository {
    constructor(private readonly prisma: PrismaService) {}

    // Suma (o resta) segundos a un día, sin dejarlo negativo
    addSeconds(userId: string, date: string, seconds: number) {
        return this.prisma.$transaction([
            this.prisma.studyDay.upsert({
                where: { userId_date: { userId, date } },
                create: { userId, date, seconds: Math.max(seconds, 0) },
                update: { seconds: { increment: seconds } },
            }),
            this.prisma.studyDay.updateMany({ where: { userId, date, seconds: { lt: 0 } }, data: { seconds: 0 } }),
        ]);
    }
    days(userId: string, from?: string) {
        return this.prisma.studyDay.findMany({ where: { userId, ...(from && { date: { gte: from } }) }, orderBy: { date: 'asc' } });
    }
}
