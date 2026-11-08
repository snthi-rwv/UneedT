import {
    ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, Param, Patch, PayloadTooLargeException, Post,
    UploadedFile, UseFilters, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MAX_FILE_BYTES } from '../../integrations/documents/document-text.service';
import { GuideDto, StepActionDto } from './dto/guide.dto';
import { GuidesService } from './guides.service';

// Traduce el error de archivo demasiado grande (multer lo da en inglés)
@Catch(PayloadTooLargeException)
class FileTooLargeFilter implements ExceptionFilter {
    catch(_e: PayloadTooLargeException, host: ArgumentsHost) {
        host.switchToHttp().getResponse().status(413).json({ statusCode: 413, message: 'El archivo pesa más de 5 MB.' });
    }
}

@UseGuards(JwtAuthGuard)
@Controller('guides')
export class GuidesController {
    constructor(private readonly svc: GuidesService) {}

    @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

    // Crea o rehace el plan de una tarea. Llama a la IA: límite más estricto que el general.
    @Post(':taskId')
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @UseFilters(FileTooLargeFilter)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
    upsert(@CurrentUser() u: AuthUser, @Param('taskId') taskId: string, @Body() dto: GuideDto, @UploadedFile() file?: Express.Multer.File) {
        return this.svc.upsert(u.id, taskId, dto, file);
    }

    @Patch('steps/:id') step(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StepActionDto) {
        return this.svc.stepAction(u.id, id, dto);
    }
}
