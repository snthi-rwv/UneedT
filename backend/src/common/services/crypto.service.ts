import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Utilidades de cifrado: AES-256-GCM para tokens de Gmail y SHA-256 para refresh tokens.
@Injectable()
export class CryptoService {
    private readonly key: Buffer;
    constructor(cfg: ConfigService) { this.key = Buffer.from(cfg.getOrThrow<string>('encKey'), 'hex'); }

    // Formato: iv(12) | tag(16) | texto cifrado, en base64
    encrypt(plain: string): string {
        const iv = randomBytes(12);
        const c = createCipheriv('aes-256-gcm', this.key, iv);
        const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
        return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
    }

    decrypt(payload: string): string {
        const raw = Buffer.from(payload, 'base64');
        const d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
        d.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    }

    sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
}