import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Capa de datos: es la única que habla con la tabla User.
@Injectable()
export class UsersRepository {
    constructor(private readonly prisma: PrismaService) {}
    findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
    findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
    findByGoogleId(googleId: string) { return this.prisma.user.findUnique({ where: { googleId } }); }
    create(data: { email: string; name: string; passwordHash?: string; googleId?: string }) { return this.prisma.user.create({ data }); }
    linkGoogle(id: string, googleId: string) { return this.prisma.user.update({ where: { id }, data: { googleId } }); }
}