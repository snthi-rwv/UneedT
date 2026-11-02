import { Injectable } from '@nestjs/common';
import { AiClient } from '../../integrations/ai/ai.client';
import { RawEmail } from '../../integrations/google/gmail.client';
import { extractorPrompt } from './email-extractor.prompts';

export interface ExtractedTask {
    messageId: string; isTask: boolean; subjectHint?: string | null; title?: string; description?: string | null;
    dueDate?: string | null; weightPct?: number | null; complexity?: number | null; estimatedHours?: number | null; confidence?: number;
}

// Capa de IA de la sincronización: correos → tareas candidatas. No toca la base de datos.
@Injectable()
export class EmailExtractorService {
    constructor(private readonly ai: AiClient) {}

    /** Devuelve null si la IA no estuvo disponible (así los correos se reintentan después). */
    async extract(emails: RawEmail[]): Promise<ExtractedTask[] | null> {
        const input = emails.map((e) => ({ messageId: e.id, de: e.from, asunto: e.subject, fecha: e.date, cuerpo: e.body }));
        const out = await this.ai.completeJson<ExtractedTask[]>(extractorPrompt(new Date().toISOString()), JSON.stringify(input), 3000);
        return Array.isArray(out) ? out : null;
    }
}