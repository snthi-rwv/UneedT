import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../common/services/crypto.service';
import { EmailAccountsRepository } from './email-accounts.repository';

// Guarda y entrega el refresh token de Gmail. En la BD siempre está cifrado.
@Injectable()
export class EmailAccountsService {
    constructor(private readonly repo: EmailAccountsRepository, private readonly crypto: CryptoService) {}

    connect(userId: string, email: string, refreshToken: string) { return this.repo.upsert(userId, email, this.crypto.encrypt(refreshToken)); }
    find(userId: string) { return this.repo.find(userId); }
    refreshTokenOf(account: { refreshTokenEnc: string }) { return this.crypto.decrypt(account.refreshTokenEnc); }
    disconnect(userId: string) { return this.repo.remove(userId); }
}