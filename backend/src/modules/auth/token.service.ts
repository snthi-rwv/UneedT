import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { CryptoService } from '../../common/services/crypto.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface TokenPair { accessToken: string; refreshToken: string }

/**
 * Manejo de JWT:
 *  - accessToken: vive poco (15 min), va en cada petición como Bearer.
 *  - refreshToken: vive más (7 días), solo sirve para pedir un nuevo par. Es de un solo uso (rotación).
 *  - Si alguien reutiliza un refresh ya usado, se revocan todas las sesiones del usuario (posible robo).
 */
@Injectable()
export class TokenService {
    constructor(
        private readonly jwt: JwtService, private readonly cfg: ConfigService, private readonly crypto: CryptoService,
        private readonly repo: RefreshTokenRepository, private readonly users: UsersService,
    ) {}

    private signAccess(user: { id: string; email: string }) {
        return this.jwt.sign({ sub: user.id, email: user.email, typ: 'access' }, { secret: this.cfg.getOrThrow('jwt.accessSecret'), expiresIn: this.cfg.get('jwt.accessTtl') });
    }

    /** Crea access + refresh y guarda el hash del refresh en la BD. */
    async issue(user: { id: string; email: string }): Promise<TokenPair> {
        const jti = randomUUID();
        const refreshToken = this.jwt.sign({ sub: user.id, jti, typ: 'refresh' }, { secret: this.cfg.getOrThrow('jwt.refreshSecret'), expiresIn: this.cfg.get('jwt.refreshTtl') });
        const { exp } = this.jwt.decode(refreshToken) as { exp: number };
        await this.repo.create({ id: jti, userId: user.id, tokenHash: this.crypto.sha256(refreshToken), expiresAt: new Date(exp * 1000) });
        return { accessToken: this.signAccess(user), refreshToken };
    }

    /** Cambia un refresh válido por un par nuevo (y gasta el anterior). */
    async rotate(refreshToken: string): Promise<{ tokens: TokenPair; user: { id: string; email: string; name: string } }> {
        const invalid = new UnauthorizedException('Sesión inválida o expirada');
        let payload: any;
        try { payload = await this.jwt.verifyAsync(refreshToken, { secret: this.cfg.getOrThrow('jwt.refreshSecret') }); } catch { throw invalid; }
        if (payload.typ !== 'refresh') throw invalid;

        const row = await this.repo.find(payload.jti);
        if (!row || row.tokenHash !== this.crypto.sha256(refreshToken)) throw invalid;
        if (row.revokedAt) { // token ya usado: alerta de reutilización
            await this.repo.revokeAllForUser(row.userId);
            throw new UnauthorizedException('Sesión comprometida: vuelve a iniciar sesión');
        }
        await this.repo.revoke(row.id);
        const user = await this.users.getPublic(row.userId);
        return { tokens: await this.issue(user), user };
    }

    /** Cierra sesión: revoca el refresh. */
    async revoke(refreshToken: string) {
        try {
            const p: any = await this.jwt.verifyAsync(refreshToken, { secret: this.cfg.getOrThrow('jwt.refreshSecret') });
            await this.repo.revoke(p.jti);
        } catch { /* si ya era inválido, no hay nada que revocar */ }
    }

    // ---- "state" firmado para OAuth: evita CSRF y dice para qué es el flujo ----
    signState(payload: { purpose: 'login' | 'gmail'; userId?: string }) {
        return this.jwt.sign({ ...payload, typ: 'oauth-state' }, { secret: this.cfg.getOrThrow('jwt.accessSecret'), expiresIn: '10m' });
    }
    verifyState(state: string): { purpose: 'login' | 'gmail'; userId?: string } {
        const p: any = this.jwt.verify(state, { secret: this.cfg.getOrThrow('jwt.accessSecret') });
        if (p.typ !== 'oauth-state') throw new Error('state inválido');
        return { purpose: p.purpose, userId: p.userId };
    }
}