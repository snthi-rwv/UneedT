import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSurveyDto } from './dto/survey.dto';
import { SurveysService } from './surveys.service';

@UseGuards(JwtAuthGuard)
@Controller('surveys')
export class SurveysController {
    constructor(private readonly svc: SurveysService) {}

    @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
    @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateSurveyDto) { return this.svc.create(u.id, dto); }
}