// Si falta algo crítico, la app no arranca (mejor fallar al inicio que en producción).
export function validateEnv(env: Record<string, any>) {
    const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_ENC_KEY'];
    const missing = required.filter((k) => !env[k]);
    if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
    if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) throw new Error('Los secretos JWT deben tener al menos 32 caracteres');
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) throw new Error('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos');
    if (!/^[0-9a-f]{64}$/i.test(env.TOKEN_ENC_KEY)) throw new Error('TOKEN_ENC_KEY debe ser 32 bytes en hex (64 caracteres)');
    return env;
}