import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiClient } from '../../integrations/ai/ai.client';
import { AiModule } from '../../integrations/ai/ai.module';

// GET /api/health: sirve para monitoreo y para ver qué está configurado.
@Controller('health')
class HealthController {
    constructor(private readonly prisma: PrismaService, private readonly ai: AiClient) {}

    @Get()
    async check() {
        await this.prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', db: 'up', aiConfigured: this.ai.enabled };
    }
}

@Module({ imports: [AiModule], controllers: [HealthController] })
export class HealthModule {}