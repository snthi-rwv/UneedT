import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GeneratePlanDto, ReplanDto, UpdateBlockDto } from './dto/study-plan.dto';
import { StudyPlanService } from './study-plan.service';

@UseGuards(JwtAuthGuard)
@Controller('study-plan')
export class StudyPlanController {
    constructor(private readonly svc: StudyPlanService) {}

    @Get() get(@CurrentUser() u: AuthUser, @Query('date') date?: string) { return this.svc.getByDate(u.id, date); }
    @Post('generate') generate(@CurrentUser() u: AuthUser, @Body() dto: GeneratePlanDto) { return this.svc.generate(u.id, dto); }
    @Post('replan') replan(@CurrentUser() u: AuthUser, @Body() dto: ReplanDto) { return this.svc.replan(u.id, dto.date); }
    @Patch('blocks/:id') block(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateBlockDto) {
        return this.svc.setBlockDone(u.id, id, dto.done);
    }
}