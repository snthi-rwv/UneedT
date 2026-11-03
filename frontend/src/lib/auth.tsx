import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, ApiError, tokens } from './api';

interface User { id: string; email: string; name: string }
interface Session { user: User; accessToken: string; refreshToken: string }
interface Ctx {
    user: User | null;
    loading: boolean;
    error: string; // problema al recuperar la sesión (por ejemplo, el servidor apagado)
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(!!tokens.refresh);
    const [error, setError] = useState('');

    // Al abrir la app, si hay sesión guardada, se recupera el usuario
    useEffect(() => {
        if (!tokens.refresh) return;
        let cancelled = false; // en desarrollo React ejecuta este efecto dos veces; se ignora la primera
        api<User>('/auth/me')
            .then((u) => { if (!cancelled) setUser(u); })
            .catch((e) => {
                if (cancelled) return;
                if (e instanceof ApiError && e.status === 401) tokens.clear(); // la sesión de verdad no sirve: se borra
                else setError('No pudimos conectar con el servidor. Revisa que esté encendido y recarga la página.'); // fallo temporal: se conserva la sesión
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const start = (s: Session) => { tokens.set(s.accessToken, s.refreshToken); setUser(s.user); setError(''); };

    return (
        <AuthCtx.Provider
            value={{
                user,
                loading,
                error,
                login: async (email, password) => start(await api<Session>('/auth/login', { body: { email, password } })),
                register: async (name, email, password) => start(await api<Session>('/auth/register', { body: { name, email, password } })),
                logout: async () => {
                    if (tokens.refresh) await api('/auth/logout', { body: { refreshToken: tokens.refresh } }).catch(() => undefined); // revoca en el servidor
                    tokens.clear();
                    setUser(null);
                },
            }}
        >
            {children}
        </AuthCtx.Provider>
    );
}