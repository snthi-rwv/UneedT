import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthUser } from '../guards/jwt-auth.guard';

// Uso: método(@CurrentUser() user: AuthUser)
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);