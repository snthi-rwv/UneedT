import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

// Permisos que pide UneedT. El de Gmail es SOLO LECTURA.
export const LOGIN_SCOPES = ['openid', 'email', 'profile'];
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

export interface GoogleProfile { id: string; email: string; name: string; verified: boolean }

// Envuelve el flujo OAuth 2.0 de Google (url de consentimiento, intercambio del code, perfil).
@Injectable()
export class GoogleOAuthClient {
    constructor(private readonly cfg: ConfigService) {}

    private newClient() {
        const { clientId, clientSecret, redirectUri } = this.cfg.get('google');
        if (!clientId || !clientSecret || !redirectUri) throw new BadRequestException('Google OAuth no está configurado en el servidor');
        return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    /** URL a la que se envía al usuario para dar su consentimiento. `state` protege contra CSRF. */
    buildAuthUrl(scopes: string[], state: string, offline = false): string {
        return this.newClient().generateAuthUrl({
            scope: scopes,
            state,
            include_granted_scopes: false,
            ...(offline && { access_type: 'offline', prompt: 'consent' }), // offline => Google entrega un refresh_token
        });
    }

    /** Cambia el `code` de Google por tokens. */
    async exchangeCode(code: string) {
        return (await this.newClient().getToken(code)).tokens;
    }

    /** Datos básicos de la cuenta que acaba de autorizar. */
    async fetchProfile(accessToken: string): Promise<GoogleProfile> {
        const client = this.newClient();
        client.setCredentials({ access_token: accessToken });
        const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
        return { id: data.id!, email: (data.email ?? '').toLowerCase(), name: data.name ?? data.email ?? 'Estudiante', verified: !!data.verified_email };
    }

    /** Cliente ya autenticado con un refresh token guardado (para leer Gmail sin pedir login otra vez). */
    authorizedClient(refreshToken: string) {
        const client = this.newClient();
        client.setCredentials({ refresh_token: refreshToken });
        return client;
    }
}