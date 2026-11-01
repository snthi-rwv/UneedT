import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Saca el JSON de la respuesta aunque el modelo lo envuelva en texto o en ```json
function extractJson(text: string): unknown {
    const clean = text.replace(/```(?:json)?/gi, '').trim();
    const start = clean.search(/[\[{]/);
    const end = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}'));
    if (start < 0 || end < start) throw new Error('la IA no devolvió JSON');
    return JSON.parse(clean.slice(start, end + 1));
}

/**
 * Único punto de contacto con la IA. Sirve para varios proveedores (se elige con AI_PROVIDER):
 *  - groq / gemini / openrouter / custom → API compatible con OpenAI (/chat/completions)
 *  - anthropic → API de Anthropic (/messages)
 * Reglas:
 *  - La clave (AI_API_KEY) vive solo en el servidor; nunca va al frontend ni a los logs.
 *  - Si el modelo principal se queda sin cuota (429) o falla, se prueba el de respaldo.
 *  - Sin clave o con todo fallando devuelve null: la app usa su plan B sin romperse.
 */
@Injectable()
export class AiClient {
    private readonly log = new Logger(AiClient.name);
    constructor(private readonly cfg: ConfigService) {}

    get enabled(): boolean {
        return !!this.cfg.get<string>('ai.apiKey') && !!this.cfg.get<string>('ai.baseUrl') && !!this.cfg.get<string>('ai.model');
    }

    // Una llamada HTTP a un modelo concreto
    private async request(model: string, system: string, user: string, maxTokens: number): Promise<string> {
        const { provider, apiKey, baseUrl, timeoutMs } = this.cfg.get('ai');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const anthropic = provider === 'anthropic';
            const res = await fetch(`${baseUrl}${anthropic ? '/messages' : '/chat/completions'}`, {
                method: 'POST',
                signal: ctrl.signal,
                headers: anthropic
                    ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
                    : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
                body: JSON.stringify(
                    anthropic
                        ? { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }
                        : { model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] },
                ),
            });
            if (!res.ok) throw Object.assign(new Error(`La IA respondió ${res.status}`), { status: res.status });
            const data: any = await res.json();
            return anthropic
                ? (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
                : (data.choices?.[0]?.message?.content ?? '');
        } finally {
            clearTimeout(timer);
        }
    }

    // Reintenta solo errores temporales del servidor. Un 429 (cuota agotada) no se reintenta: pasa al modelo de respaldo.
    private async withRetry(model: string, system: string, user: string, maxTokens: number): Promise<string> {
        for (let attempt = 0; ; attempt++) {
            try {
                return await this.request(model, system, user, maxTokens);
            } catch (e: any) {
                const temporary = e.name === 'AbortError' || e.status >= 500;
                if (!temporary || attempt >= 2) throw e;
                await sleep(500 * 2 ** attempt);
            }
        }
    }

    /** Pide una respuesta en JSON y la parsea. Devuelve null si no se pudo. */
    async completeJson<T>(system: string, user: string, maxTokens = 1500): Promise<T | null> {
        if (!this.enabled) return null;
        const models = [this.cfg.get<string>('ai.model'), this.cfg.get<string>('ai.fallbackModel')].filter((m, i, a) => m && a.indexOf(m) === i);
        const sys = `${system}\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.`;

        for (const model of models) {
            try {
                return extractJson(await this.withRetry(model, sys, user, maxTokens)) as T;
            } catch (e: any) {
                // Solo se registra el tipo de fallo; jamás la clave ni el contenido del usuario
                this.log.warn(`Falló el modelo ${model}: ${e.status ?? e.name ?? e.message}`);
            }
        }
        return null;
    }
}