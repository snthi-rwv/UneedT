import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { hours } from '../lib/format';
import { DueText, Empty, Err, PageHead, ScoreChip, useLoad } from '../components/ui';
import { EmailStatus, Focus, Task } from '../types';

// Pantalla "Hoy": responde a la pregunta "¿por dónde empiezo?"
export default function Today() {
    const { user } = useAuth();
    const { data, error, reload } = useLoad(() => api<Focus>('/tasks/focus'));
    const email = useLoad(() => api<EmailStatus>('/email/status'));
    const [busy, setBusy] = useState('');
    const [actionError, setActionError] = useState('');

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key);
        setActionError('');
        try { await fn(); await reload(); }
        catch (e) { setActionError((e as Error).message); }
        finally { setBusy(''); }
    };
    const setStatus = (t: Task, status: Task['status']) => run(t.id + status, () => api(`/tasks/${t.id}`, { method: 'PATCH', body: { status } }));
    const prioritize = () => run('ai', () => api('/tasks/prioritize', { method: 'POST' }));

    const top = data?.top;
    const pending = email.data?.pending ?? 0;

    return (
        <>
            <PageHead title={`Hola, ${user?.name?.split(' ')[0] ?? ''}`}>
                <button className="btn" onClick={prioritize} disabled={!!busy || !data?.openCount}>
                    {busy === 'ai' ? 'Pensando…' : 'Repriorizar con IA'}
                </button>
            </PageHead>
            <Err msg={error || actionError} />

            {pending > 0 && (
                <p className="note">La IA encontró {pending} posible{pending === 1 ? '' : 's'} tarea{pending === 1 ? '' : 's'} en tu correo. <Link to="/correo">Revisar</Link></p>
            )}

            {data && !top && (
                <Empty title="No tienes tareas abiertas">
                    Agrega una en <Link to="/tareas">Tareas</Link> o conecta tu correo en <Link to="/correo">Correo</Link> para que UneedT las encuentre.
                </Empty>
            )}

            {top && (
                <section className="start" aria-labelledby="top-title">
                    <p className="start-label">Empieza por aquí</p>
                    <h2 id="top-title">{top.title}</h2>
                    <p className="start-why">{top.priorityReason}</p>
                    <div className="meta">
                        <ScoreChip task={top} />
                        {top.subject && <span><i className="dot" style={{ background: top.subject.color }} /> {top.subject.name}</span>}
                        <DueText iso={top.dueDate} />
                        <span>{top.weightPct}% de la nota</span>
                        <span>{hours(Math.max(top.estimatedHours - top.hoursSpent, 0))} pendientes</span>
                    </div>
                    <div className="row">
                        {top.status === 'PENDING' && (
                            <button className="btn primary" disabled={!!busy} onClick={() => setStatus(top, 'IN_PROGRESS')}>Empezar</button>
                        )}
                        <button className="btn" disabled={!!busy} onClick={() => setStatus(top, 'DONE')}>Marcar como terminada</button>
                        <Link className="btn" to="/plan">Ver plan del día</Link>
                    </div>
                </section>
            )}

            {data && data.openCount > 0 && (
                <div className="stats">
                    <div className={data.overdue ? 'bad' : ''}><b>{data.overdue}</b><span>vencidas</span></div>
                    <div className={data.dueSoon ? 'warn' : ''}><b>{data.dueSoon}</b><span>vencen en 48 h</span></div>
                    <div><b>{data.openCount}</b><span>abiertas</span></div>
                </div>
            )}

            {!!data?.next.length && (
                <>
                    <h3>Después</h3>
                    <ul className="list">
                        {data.next.map((t) => (
                            <li key={t.id}>
                                <ScoreChip task={t} />
                                <div className="grow">
                                    <strong>{t.title}</strong>
                                    <small>{t.subject?.name ?? 'Sin materia'} · {t.priorityReason}</small>
                                </div>
                                <DueText iso={t.dueDate} />
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </>
    );
}
