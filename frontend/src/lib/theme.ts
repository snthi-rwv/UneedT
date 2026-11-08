import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'uneedt-theme';

// Lo que eligió el usuario (si eligió algo). Sin elección, se sigue el tema del sistema.
function savedChoice(): Theme | null {
    try {
        const t = localStorage.getItem(KEY);
        return t === 'light' || t === 'dark' ? t : null;
    } catch {
        return null; // navegación privada o almacenamiento bloqueado
    }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/**
 * Tema claro/oscuro. Se aplica como <html data-theme="..."> y el CSS hace el resto.
 * index.html ya lo aplica antes de pintar, para que no haya parpadeo al cargar.
 */
export function useTheme() {
    const [choice, setChoice] = useState<Theme | null>(savedChoice);
    const [system, setSystem] = useState<Theme>(systemTheme);
    const theme = choice ?? system;

    // Si el usuario no ha elegido, acompaña los cambios del sistema operativo
    useEffect(() => {
        const m = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => setSystem(m.matches ? 'dark' : 'light');
        m.addEventListener('change', onChange);
        return () => m.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setChoice(next);
        try { localStorage.setItem(KEY, next); } catch { /* sin almacenamiento: dura solo esta visita */ }
    };

    return { theme, toggle };
}
