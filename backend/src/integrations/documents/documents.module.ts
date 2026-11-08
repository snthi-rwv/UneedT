import { Module } from '@nestjs/common';
import { DocumentTextService } from './document-text.service';

@Module({ providers: [DocumentTextService], exports: [DocumentTextService] })
export class DocumentsModule {}
