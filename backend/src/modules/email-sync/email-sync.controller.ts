import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProposalStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AcceptProposalDto } from './dto/proposal.dto';
import { EmailSyncService } from './email-sync.service';
import { ProposalsService } from './proposals.service';

@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailSyncController {
    constructor(private readonly sync: EmailSyncService, private readonly proposals: ProposalsService) {}

    @Get('status') status(@CurrentUser() u: AuthUser) { return this.sync.status(u.id); }

    @Throttle({ default: { ttl: 60_000, limit: 4 } }) // cada sync cuesta IA: límite bajo
    @Post('sync') syncNow(@CurrentUser() u: AuthUser) { return this.sync.syncUser(u.id); }

    @Delete('account') disconnect(@CurrentUser() u: AuthUser) { return this.sync.disconnect(u.id); }

    @Get('proposals') list(@CurrentUser() u: AuthUser, @Query('status') status?: ProposalStatus) { return this.proposals.list(u.id, status); }
    @Post('proposals/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AcceptProposalDto) {
        return this.proposals.accept(u.id, id, dto);
    }
    @Post('proposals/:id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.proposals.reject(u.id, id); }
}