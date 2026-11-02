import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de la cuenta de Gmail conectada.
@Injectable()
export class EmailAccountsRepository {
    constructor(private readonly prisma: PrismaService) {}

    find(userId: string) { return this.prisma.emailAccount.findUnique({ where: { userId } }); }
    listActive() { return this.prisma.emailAccount.findMany({ where: { status: 'ACTIVE' } }); }
    upsert(userId: string, email: string, refreshTokenEnc: string) {
        return this.prisma.emailAccount.upsert({
            where: { userId },
            update: { email, refreshTokenEnc, status: 'ACTIVE' },
            create: { userId, email, refreshTokenEnc },
        });
    }
    markRevoked(userId: string) { return this.prisma.emailAccount.update({ where: { userId }, data: { status: 'REVOKED' } }); }
    touch(userId: string) { return this.prisma.emailAccount.update({ where: { userId }, data: { lastSyncAt: new Date() } }); }
    remove(userId: string) { return this.prisma.emailAccount.deleteMany({ where: { userId } }); }
}