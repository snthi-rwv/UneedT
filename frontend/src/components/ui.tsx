import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Task } from '../types';
import { fmtDue } from '../lib/format';

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
export function ScoreChip({ task }: { task: Task }) {
    const level = task.priorityScore >= 65 ? 'hi' : task.priorityScore >= 40 ? 'mid' : 'lo';
    return <span className={`chip ${level}`} title="Puntaje de prioridad (0-100)">{Math.round(task.priorityScore)}</span>;
}

export function DueText({ iso }: { iso: string }) {
    const d = fmtDue(iso);
    return <span className={`due ${d.tone}`}>{d.text}</span>;
}