import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenService } from './token.service';

// Lógica de negocio de autenticación con correo y contraseña.
@Injectable()
export class AuthService {
    constructor(private readonly users: UsersService, private readonly tokens: TokenService) {}

    async register(dto: RegisterDto) {
        if (await this.users.findByEmail(dto.email)) throw new ConflictException('Ese correo ya tiene una cuenta');
        const user = await this.users.create({ email: dto.email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 12) });
        return { user: { id: user.id, email: user.email, name: user.name }, ...(await this.tokens.issue(user)) };
    }

    async login(dto: LoginDto) {
        const user = await this.users.findByEmail(dto.email);
        // Mismo mensaje si no existe, si es cuenta solo-Google o si la clave es mala (no filtra qué correos existen)
        if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Correo o contraseña incorrectos');
        return { user: { id: user.id, email: user.email, name: user.name }, ...(await this.tokens.issue(user)) };
    }

    async refresh(refreshToken: string) {
        const { tokens, user } = await this.tokens.rotate(refreshToken);
        return { user, ...tokens };
    }

    async logout(refreshToken: string) { await this.tokens.revoke(refreshToken); return { ok: true }; }
    me(userId: string) { return this.users.getPublic(userId); }
}