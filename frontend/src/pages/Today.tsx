import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { hours } from '../lib/format';
import { DueText, Empty, Err, PageHead, ScoreChip, useLoad } from '../components/ui';
import MonthCalendar from '../components/MonthCalendar';
import ContextDialog from '../components/ContextDialog';
import { EmailStatus, Focus, Guide, GuideList, Task } from '../types';

// Página principal: responde a la pregunta "¿por dónde empiezo?"
export default function Today() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data, error, reload } = useLoad(() => api<Focus>('/tasks/focus'));
    const email = useLoad(() => api<EmailStatus>('/email/status'));
    const all = useLoad(() => api<Task[]>('/tasks')); // todas las tareas, para el calendario
    const [busy, setBusy] = useState('');
    const [actionError, setActionError] = useState('');
    const [aiNote, setAiNote] = useState('');
    const [starting, setStarting] = useState<{ task: Task; guide: Guide | null } | null>(null);

    // Al entrar, la IA reprioriza en segundo plano (el servidor lo limita a una vez cada 6 horas)
    useEffect(() => {
        let alive = true;
        api<{ ran: boolean; usedAi: boolean; refined: number }>('/tasks/prioritize/auto', { method: 'POST' })
            .then((r) => {
                if (!alive || !r.ran || !r.usedAi) return;
                reload();
                all.reload();
                setAiNote('La IA revisó tus tareas y actualizó las prioridades.');
            })
            .catch(() => undefined); // si falla, la app sigue con la prioridad de la fórmula
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // "Empezar" abre la ventana de contexto. Si la tarea ya tenía paso a paso, se carga para mostrar su contexto.
    const openStart = async (t: Task) => {
        setActionError('');
        if (!t.guide) return setStarting({ task: t, guide: null });
        setBusy('open');
        try {
            const list = await api<GuideList>('/guides');
            setStarting({ task: t, guide: list.tasks.find((x) => x.id === t.id)?.guide ?? null });
        } catch (e) {
            setActionError((e as Error).message);
        } finally {
            setBusy('');
        }
    };

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key);
        setActionError('');
        try { await fn(); await Promise.all([reload(), all.reload()]); }
        catch (e) { setActionError((e as Error).message); }
        finally { setBusy(''); }
    };
    const setStatus = (t: Task, status: Task['status']) => run(t.id + status, () => api(`/tasks/${t.id}`, { method: 'PATCH', body: { status } }));
    const prioritize = () => run('ai', async () => { await api('/tasks/prioritize', { method: 'POST' }); setAiNote(''); });

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
            {aiNote && <p className="note ok" role="status">{aiNote} <button type="button" className="link" onClick={() => setAiNote('')}>Entendido</button></p>}

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
                        {top.status === 'IN_PROGRESS' && <em className="badge">En curso</em>}
                        {top.subject && <span><i className="dot" style={{ background: top.subject.color }} /> {top.subject.name}</span>}
                        <DueText iso={top.dueDate} />
                        <span>{top.weightPct}% de la nota</span>
                        <span>{hours(Math.max(top.estimatedHours - top.hoursSpent, 0))} pendientes</span>
                    </div>
                    <div className="row">
                        {top.status === 'PENDING'
                            ? <button className="btn primary" disabled={!!busy} onClick={() => openStart(top)}>{busy === 'open' ? 'Abriendo…' : 'Empezar'}</button>
                            : <Link className="btn primary" to={`/plan?tarea=${top.id}`}>Continuar en el plan</Link>}
                        <button className="btn" disabled={!!busy} onClick={() => setStatus(top, 'DONE')}>Marcar como terminada</button>
                        {top.status === 'PENDING' && <Link className="btn" to="/plan">Ver plan del día</Link>}
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

            {!!all.data?.length && (
                <>
                    <h3>Tu mes</h3>
                    <MonthCalendar tasks={all.data} />
                </>
            )}

            {starting && (
                <ContextDialog
                    task={starting.task}
                    guide={starting.guide}
                    mode="start"
                    onClose={() => setStarting(null)}
                    onDone={() => navigate(`/plan?tarea=${starting.task.id}`)}
                />
            )}
        </>
    );
}
