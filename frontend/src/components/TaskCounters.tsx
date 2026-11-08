import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, DATA_CHANGED } from '../lib/api';

/**
 * Fichas del panel izquierdo (mismo estilo que la racha): tareas vencidas y tareas abiertas.
 * Se actualizan al cambiar de pantalla y cada vez que el estudiante cambia algo en la app.
 */
export default function TaskCounters() {
    const [c, setC] = useState<{ overdue: number; open: number } | null>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        let alive = true;
        const load = () => api<{ overdue: number; open: number }>('/tasks/counts').then((r) => alive && setC(r)).catch(() => undefined);
        load();
        window.addEventListener(DATA_CHANGED, load);
        return () => { alive = false; window.removeEventListener(DATA_CHANGED, load); };
    }, [pathname]);

    if (!c) return null;
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

    return (
        <>
            <Link to="/tareas" className={`streak count count-overdue${c.overdue ? ' alert' : ' zero'}`}
                aria-label={`${plural(c.overdue, 'tarea vencida', 'tareas vencidas')}. Ver tareas.`}>
                <span className="streak-ring count-ring"><b>{c.overdue}</b></span>
                <span className="streak-text">
                    <strong>{c.overdue === 1 ? 'Vencida' : 'Vencidas'}</strong>
                    <small>{c.overdue ? 'Entrégalas cuanto antes' : 'Vas al día'}</small>
                </span>
            </Link>
            <Link to="/tareas" className="streak count count-open" aria-label={`${plural(c.open, 'tarea abierta', 'tareas abiertas')}. Ver tareas.`}>
                <span className="streak-ring count-ring"><b>{c.open}</b></span>
                <span className="streak-text">
                    <strong>{c.open === 1 ? 'Abierta' : 'Abiertas'}</strong>
                    <small>Tareas por terminar</small>
                </span>
            </Link>
        </>
    );
}
