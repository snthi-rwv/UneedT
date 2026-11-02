import { BadRequestException, Injectable } from '@nestjs/common';
import { GMAIL_SCOPES, GoogleOAuthClient, LOGIN_SCOPES } from '../../integrations/google/google-oauth.client';
import { TokenService } from '../auth/token.service';
import { EmailAccountsService } from '../email-sync/email-accounts.service';
import { EmailSyncService } from '../email-sync/email-sync.service';
import { UsersService } from '../users/users.service';

export type CallbackResult = { kind: 'login'; accessToken: string; refreshToken: string } | { kind: 'gmail' };

/**
 * Un solo callback de Google para dos flujos:
 *  - login: "Continuar con Google" (identidad) → devuelve nuestros JWT
 *  - gmail: conectar el correo (lectura) → guarda el refresh token cifrado
 */
@Injectable()
export class OAuthService {
    constructor(
        private readonly google: GoogleOAuthClient,
        private readonly tokens: TokenService,
        private readonly users: UsersService,
        private readonly accounts: EmailAccountsService,
        private readonly sync: EmailSyncService,
    ) {}

    loginUrl() { return this.google.buildAuthUrl(LOGIN_SCOPES, this.tokens.signState({ purpose: 'login' })); }
    gmailUrl(userId: string) { return this.google.buildAuthUrl(GMAIL_SCOPES, this.tokens.signState({ purpose: 'gmail', userId }), true); }

    async handleCallback(code: string, state: string): Promise<CallbackResult> {
        let s: ReturnType<TokenService['verifyState']>;
        try { s = this.tokens.verifyState(state); }
        catch { throw new BadRequestException('La autorización venció o es inválida. Inténtalo de nuevo.'); }

        const g = await this.google.exchangeCode(code);
        if (!g.access_token) throw new BadRequestException('Google no entregó el acceso');
        const profile = await this.google.fetchProfile(g.access_token);

        if (s.purpose === 'login') {
            if (!profile.verified) throw new BadRequestException('Tu correo de Google no está verificado');
            const user = await this.users.findOrCreateFromGoogle(profile);
            return { kind: 'login', ...(await this.tokens.issue(user)) };
        }

        // Conexión de Gmail
        if (!s.userId) throw new BadRequestException('Falta el usuario en la autorización');
        if (!g.refresh_token) throw new BadRequestException('Google no entregó permiso de lectura persistente. Vuelve a intentarlo.');
        await this.accounts.connect(s.userId, profile.email, g.refresh_token);
        this.sync.syncUser(s.userId).catch(() => undefined); // primera lectura en segundo plano
        return { kind: 'gmail' };
    }
}