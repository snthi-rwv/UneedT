import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
    constructor(private readonly svc: SubjectsService) {}
    @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
    @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateSubjectDto) { return this.svc.create(u.id, dto); }
    @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateSubjectDto) { return this.svc.update(u.id, id, dto); }
    @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.remove(u.id, id); }
}