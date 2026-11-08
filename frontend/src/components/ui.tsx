import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Task } from '../types';
import { fmtDue } from '../lib/format';
import { useTheme } from '../lib/theme';

// Carga datos de la API y expone { data, error, loading, reload }
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const reload = useCallback(
        () => {
            setLoading(true);
            return fn().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
        },
        deps, // eslint-disable-line
    );
    useEffect(() => { reload(); }, [reload]);
    return { data, error, loading, reload, setData };
}

export const Err = ({ msg }: { msg: string }) => (msg ? <p className="err" role="alert">{msg}</p> : null);

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
    <div className="empty"><strong>{title}</strong><p>{children}</p></div>
);

export const PageHead = ({ title, children }: { title: string; children?: ReactNode }) => (
    <header className="phead"><h1>{title}</h1><div className="row">{children}</div></header>
);

// Puntaje de prioridad con color: rojo (crítica), ámbar (media), gris (baja)
export const priorityLevel = (score: number) => (score >= 65 ? 'hi' : score >= 40 ? 'mid' : 'lo');

export function ScoreChip({ task }: { task: Task }) {
    const level = priorityLevel(task.priorityScore);
    return <span className={`chip ${level}`} title="Puntaje de prioridad (0-100)">{Math.round(task.priorityScore)}</span>;
}

export function DueText({ iso }: { iso: string }) {
    const d = fmtDue(iso);
    return <span className={`due ${d.tone}`}>{d.text}</span>;
}

// Botón para cambiar entre modo claro y oscuro. La elección se recuerda en este navegador.
export function ThemeToggle({ className = '' }: { className?: string }) {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';
    const label = dark ? 'Modo claro' : 'Modo oscuro';
    return (
        <button type="button" className={`tool-btn ${className}`} onClick={toggle} aria-label={`Cambiar a ${label.toLowerCase()}`} title={`Cambiar a ${label.toLowerCase()}`}>
            {dark ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4.5" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
                </svg>
            )}
            <span className="tool-label">{label}</span>
        </button>
    );
}

// Botón de pantalla completa. Se oculta donde el navegador no lo permite (por ejemplo, Safari en iPhone).
export function FullscreenToggle({ className = '' }: { className?: string }) {
    const [on, setOn] = useState(() => !!document.fullscreenElement);
    useEffect(() => {
        const sync = () => setOn(!!document.fullscreenElement); // también cubre salir con la tecla Esc
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);
    if (!document.fullscreenEnabled) return null;

    const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
    const label = on ? 'Salir de pantalla completa' : 'Pantalla completa';
    return (
        <button type="button" className={`tool-btn ${className}`} onClick={toggle} aria-label={label} title={label} aria-pressed={on}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {on
                    ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
            <span className="tool-label">{on ? 'Salir' : 'Pantalla completa'}</span>
        </button>
    );
}
