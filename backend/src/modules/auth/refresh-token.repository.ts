import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos de los refresh tokens (se guarda el hash, no el token).
@Injectable()
export class RefreshTokenRepository {
    constructor(private readonly prisma: PrismaService) {}
    create(data: { id: string; userId: string; tokenHash: string; expiresAt: Date }) { return this.prisma.refreshToken.create({ data }); }
    find(id: string) { return this.prisma.refreshToken.findUnique({ where: { id } }); }
    revoke(id: string) { return this.prisma.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }); }
    revokeAllForUser(userId: string) { return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
    deleteExpired() { return this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }); }
}