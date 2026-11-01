import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

// Capa HTTP: solo recibe, delega al servicio y responde.
@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Throttle({ default: { ttl: 60_000, limit: 10 } }) // frena fuerza bruta
    @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @HttpCode(200) @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }

    @Throttle({ default: { ttl: 60_000, limit: 30 } })
    @HttpCode(200) @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

    @HttpCode(200) @Post('logout') logout(@Body() dto: RefreshDto) { return this.auth.logout(dto.refreshToken); }

    @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }
}