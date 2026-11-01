import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

// Datos que entrega Google al iniciar sesión
export interface GoogleProfile { id: string; email: string; name: string; verified: boolean }

@Injectable()
export class UsersService {
    constructor(private readonly repo: UsersRepository) {}

    findByEmail(email: string) { return this.repo.findByEmail(email.toLowerCase().trim()); }
    create(data: { email: string; name: string; passwordHash?: string }) { return this.repo.create({ ...data, email: data.email.toLowerCase().trim() }); }

    // Versión pública del usuario (sin hash de contraseña)
    async getPublic(id: string) {
        const u = await this.repo.findById(id);
        if (!u) throw new NotFoundException('Usuario no encontrado');
        return { id: u.id, email: u.email, name: u.name };
    }

    // Inicio de sesión con Google: busca por googleId, luego por correo (y vincula), o crea la cuenta.
    async findOrCreateFromGoogle(p: GoogleProfile) {
        const byGoogle = await this.repo.findByGoogleId(p.id);
        if (byGoogle) return byGoogle;
        const byEmail = await this.repo.findByEmail(p.email);
        if (byEmail) return this.repo.linkGoogle(byEmail.id, p.id); // solo llegamos aquí con correo verificado por Google
        return this.repo.create({ email: p.email, name: p.name, googleId: p.id });
    }
}