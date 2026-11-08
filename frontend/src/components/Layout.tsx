import { ReactNode, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import StreakBadge from './StreakBadge';
import TaskCounters from './TaskCounters';
import { FullscreenToggle, ThemeToggle } from './ui';

const links = [
    ['/', 'Inicio'], ['/tareas', 'Tareas'], ['/materias', 'Materias'], ['/plan', 'Plan de estudio'], ['/correo', 'Correo'], ['/progreso', 'Progreso'],
];

export default function Layout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const { pathname } = useLocation();
    const nav = useRef<HTMLElement>(null);

    // En celular el menú es una franja que se desliza: se mueve para que la sección actual quede a la vista
    useEffect(() => {
        nav.current?.querySelector('a.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [pathname]);

    return (
        <div className="shell">
            <aside className="side">
                <div className="brand">
                    {/* Logo: tres círculos unidos por tres líneas (dibujado con código) */}
                    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M16 7 7 24.5h18Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
                        <circle cx="16" cy="7" r="4.6" fill="currentColor" />
                        <circle cx="7" cy="24.5" r="4.6" fill="currentColor" />
                        <circle cx="25" cy="24.5" r="4.6" fill="currentColor" />
                    </svg>
                    UneedT
                </div>
                <div className="side-cards">
                    <StreakBadge />
                    <TaskCounters />
                </div>
                <nav ref={nav} aria-label="Secciones">
                    {links.map(([to, label]) => (
                        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{label}</NavLink>
                    ))}
                </nav>
                <div className="me">
                    <span className="me-name">{user?.name}</span>
                    <ThemeToggle />
                    <FullscreenToggle />
                    <button className="link" onClick={logout}>Cerrar sesión</button>
                </div>
            </aside>
            <main className="main">{children}</main>
        </div>
    );
}