import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const links = [
    ['/', 'Hoy'], ['/tareas', 'Tareas'], ['/materias', 'Materias'], ['/plan', 'Plan de estudio'], ['/correo', 'Correo'], ['/progreso', 'Progreso'],
];

export default function Layout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    return (
        <div className="shell">
            <aside className="side">
                <div className="brand">UneedT</div>
                <nav>
                    {links.map(([to, label]) => (
                        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>{label}</NavLink>
                    ))}
                </nav>
                <div className="me">
                    <span>{user?.name}</span>
                    <button className="link" onClick={logout}>Cerrar sesión</button>
                </div>
            </aside>
            <main className="main">{children}</main>
        </div>
    );
}