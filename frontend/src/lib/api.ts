// Cliente HTTP del frontend: agrega el JWT y renueva la sesión solo cuando vence.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const tokens = {
    get access() { return localStorage.getItem('uneedt_access'); },
    get refresh() { return localStorage.getItem('uneedt_refresh'); },
    set(access: string, refresh: string) { localStorage.setItem('uneedt_access', access); localStorage.setItem('uneedt_refresh', refresh); },
    clear() { localStorage.removeItem('uneedt_access'); localStorage.removeItem('uneedt_refresh'); },
};

export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

// Estas rutas nunca intentan renovar la sesión (no tendría sentido). OJO: /auth/me SÍ debe poder renovarla.
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

async function raw(path: string, method: string, body?: unknown, withAuth = true) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(withAuth && tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { res, data: text ? JSON.parse(text) : null };
}

// Si varias peticiones fallan a la vez, se renueva una sola vez (el refresh token es de un solo uso)
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
    if (!tokens.refresh) return Promise.resolve(false);
    refreshing ??= raw('/auth/refresh', 'POST', { refreshToken: tokens.refresh }, false)
        .then(({ res, data }) => {
            if (!res.ok) return false;
            tokens.set(data.accessToken, data.refreshToken);
            return true;
        })
        .catch(() => false)
        .finally(() => { refreshing = null; });
    return refreshing;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = opts.method ?? (opts.body ? 'POST' : 'GET');
    let { res, data } = await raw(path, method, opts.body);

    // Access token vencido: renueva y reintenta una vez
    if (res.status === 401 && !NO_REFRESH.includes(path) && (await refreshSession())) {
        ({ res, data } = await raw(path, method, opts.body));
    }

    if (!res.ok) {
        // Sesión perdida en una pantalla normal: se limpia y se vuelve al inicio (las rutas /auth/* lo manejan quien las llama)
        if (res.status === 401 && !path.startsWith('/auth/')) { tokens.clear(); window.location.href = '/'; }
        const m = data?.message;
        throw new ApiError(Array.isArray(m) ? m.join('. ') : m || 'Algo salió mal. Inténtalo de nuevo.', res.status);
    }
    return data as T;
}