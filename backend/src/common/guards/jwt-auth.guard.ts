import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser { id: string; email: string }

// Protege rutas: exige "Authorization: Bearer <accessToken>" y que el token sea de tipo "access".
@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwt: JwtService, private readonly cfg: ConfigService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const [type, token] = String(req.headers.authorization ?? '').split(' ');
        if (type !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token de sesión');
        try {
            const p = await this.jwt.verifyAsync(token, { secret: this.cfg.getOrThrow('jwt.accessSecret') });
            if (p.typ !== 'access') throw new Error('tipo de token incorrecto');
            req.user = { id: p.sub, email: p.email } as AuthUser;
            return true;
        } catch {
            throw new UnauthorizedException('Sesión inválida o expirada');
        }
    }
}