// Configuración tipada: todo lo que viene de variables de entorno pasa por aquí.

// Proveedores de IA con valores por defecto (se pueden sobrescribir con AI_BASE_URL / AI_MODEL / AI_FALLBACK_MODEL)
const PRESETS: Record<string, { baseUrl?: string; model?: string; fallbackModel?: string }> = {
    groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', fallbackModel: 'llama-3.1-8b-instant' },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', fallbackModel: 'gemini-2.5-flash-lite' },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1' }, // el modelo gratuito lo eliges tú en AI_MODEL
    anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', fallbackModel: 'claude-sonnet-5-5' },
};
const provider = (process.env.AI_PROVIDER ?? 'groq').toLowerCase();
const preset = PRESETS[provider] ?? {}; // "custom": cualquier API compatible con OpenAI vía AI_BASE_URL

export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    encKey: process.env.TOKEN_ENC_KEY,
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
        refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
    },
    ai: {
        provider,
        apiKey: process.env.AI_API_KEY,
        baseUrl: process.env.AI_BASE_URL ?? preset.baseUrl,
        model: process.env.AI_MODEL ?? preset.model,
        fallbackModel: process.env.AI_FALLBACK_MODEL ?? preset.fallbackModel,
        timeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? '30000', 10),
    },
});