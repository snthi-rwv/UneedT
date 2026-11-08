import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
    constructor(private readonly svc: ActivityService) {}

    @Get('streak') streak(@CurrentUser() u: AuthUser) { return this.svc.streak(u.id); }
    @Get('days') days(@CurrentUser() u: AuthUser, @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
        return this.svc.days(u.id, Math.min(Math.max(days, 7), 180));
    }
}
