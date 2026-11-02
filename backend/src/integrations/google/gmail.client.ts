import { Injectable } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { GoogleOAuthClient } from './google-oauth.client';

export interface RawEmail { id: string; from: string; subject: string; date: string; snippet: string; body: string }

// Saca el texto plano de un mensaje (que puede venir en varias partes)
function plainText(payload: any): string {
    const parts: string[] = [];
    const walk = (p: any) => {
        if (!p) return;
        if (p.mimeType === 'text/plain' && p.body?.data) parts.push(Buffer.from(p.body.data, 'base64url').toString('utf8'));
        (p.parts ?? []).forEach(walk);
    };
    walk(payload);
    return parts.join('\n');
}

// Sesión de lectura de Gmail para un usuario
export class GmailSession {
    constructor(private readonly gmail: gmail_v1.Gmail) {}

    /** Ids de correos recientes, sin promociones ni redes sociales. */
    async listRecentIds(days: number, max = 50): Promise<string[]> {
        const res = await this.gmail.users.messages.list({
            userId: 'me',
            q: `newer_than:${days}d -category:promotions -category:social`,
            maxResults: max,
        });
        return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
    }

    /** Descarga cada correo y lo reduce a lo que la IA necesita. */
    async getMessages(ids: string[]): Promise<RawEmail[]> {
        const out: RawEmail[] = [];
        for (const id of ids) {
            const m = await this.gmail.users.messages.get({ userId: 'me', id, format: 'full' });
            const header = (name: string) => m.data.payload?.headers?.find((h) => h.name?.toLowerCase() === name)?.value ?? '';
            out.push({
                id,
                from: header('from'),
                subject: header('subject'),
                date: header('date'),
                snippet: m.data.snippet ?? '',
                body: (plainText(m.data.payload) || m.data.snippet || '').slice(0, 1500), // se recorta para respetar los límites de la IA gratuita
            });
        }
        return out;
    }
}

@Injectable()
export class GmailClient {
    constructor(private readonly oauth: GoogleOAuthClient) {}

    open(refreshToken: string): GmailSession {
        return new GmailSession(google.gmail({ version: 'v1', auth: this.oauth.authorizedClient(refreshToken) }));
    }
}