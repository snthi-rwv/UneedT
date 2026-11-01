import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

@Module({
    imports: [UsersModule],
    controllers: [AuthController],
    providers: [AuthService, TokenService, RefreshTokenRepository],
    exports: [TokenService],
})
export class AuthModule {}