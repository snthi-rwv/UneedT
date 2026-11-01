import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
    constructor(private readonly svc: TasksService) {}

    @Get() list(@CurrentUser() u: AuthUser, @Query('status') status?: TaskStatus, @Query('subjectId') subjectId?: string) {
        return this.svc.list(u.id, { status, subjectId });
    }
    @Get('focus') focus(@CurrentUser() u: AuthUser) { return this.svc.focus(u.id); }
    @Post('prioritize') prioritize(@CurrentUser() u: AuthUser) { return this.svc.prioritizeWithAi(u.id); }
    @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateTaskDto) { return this.svc.create(u.id, dto); }
    @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) { return this.svc.update(u.id, id, dto); }
    @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u.id, id); }
}