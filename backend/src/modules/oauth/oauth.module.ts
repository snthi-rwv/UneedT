import { Module } from '@nestjs/common';
import { GoogleModule } from '../../integrations/google/google.module';
import { AuthModule } from '../auth/auth.module';
import { EmailSyncModule } from '../email-sync/email-sync.module';
import { UsersModule } from '../users/users.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
    imports: [GoogleModule, AuthModule, UsersModule, EmailSyncModule],
    controllers: [OAuthController],
    providers: [OAuthService],
})
export class OAuthModule {}