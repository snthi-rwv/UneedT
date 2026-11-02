import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthService } from './oauth.service';

@Controller('oauth/google')
export class OAuthController {
    constructor(private readonly oauth: OAuthService, private readonly cfg: ConfigService) {}

    // 1) Inicio de sesión: redirige directo a Google
    @Get('login') login(@Res() res: Response) { return res.redirect(this.oauth.loginUrl()); }

    // 2) Conectar Gmail: el frontend pide la URL (con su JWT) y navega hacia ella
    @UseGuards(JwtAuthGuard)
    @Get('gmail/connect-url') gmailUrl(@CurrentUser() u: AuthUser) { return { url: this.oauth.gmailUrl(u.id) }; }

    // 3) Google vuelve aquí (público: la identidad viaja en el `state` firmado)
    @Get('callback')
    async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
        const front = this.cfg.get<string>('frontendUrl');
        if (error || !code || !state) return res.redirect(`${front}/?oauth_error=${encodeURIComponent(error || 'cancelado')}`);
        try {
            const r = await this.oauth.handleCallback(code, state);
            if (r.kind === 'gmail') return res.redirect(`${front}/correo?connected=1`);
            // Los tokens van en el fragmento (#), que el navegador no envía a ningún servidor
            return res.redirect(`${front}/auth/callback#access=${r.accessToken}&refresh=${r.refreshToken}`);
        } catch (e: any) {
            return res.redirect(`${front}/?oauth_error=${encodeURIComponent(e?.message ?? 'error')}`);
        }
    }
}