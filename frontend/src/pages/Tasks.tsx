import { useState } from 'react';
import { api } from '../lib/api';
import { hours } from '../lib/format';
import TaskForm from '../components/TaskForm';
import { DueText, Empty, Err, PageHead, ScoreChip, useLoad } from '../components/ui';
import { Subject, Task, TaskStatus } from '../types';

const TABS: [TaskStatus | 'OPEN', string][] = [['OPEN', 'Abiertas'], ['DONE', 'Terminadas']];
const STATUS_LABEL: Record<TaskStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', DONE: 'Terminada' };

export default function Tasks() {
    const [tab, setTab] = useState<TaskStatus | 'OPEN'>('OPEN');
    const [subjectId, setSubjectId] = useState('');
    const [editing, setEditing] = useState<Task | 'new' | null>(null);
    const [actionError, setActionError] = useState('');

    const tasks = useLoad(() => api<Task[]>(`/tasks${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''}`), [subjectId]);
    const subjects = useLoad(() => api<Subject[]>('/subjects'));

    const shown = (tasks.data ?? []).filter((t) => (tab === 'OPEN' ? t.status !== 'DONE' : t.status === 'DONE'));

    const act = async (fn: () => Promise<unknown>) => {
        setActionError('');
        try { await fn(); await tasks.reload(); }
        catch (e) { setActionError((e as Error).message); }
    };
    const setStatus = (t: Task, status: TaskStatus) => act(() => api(`/tasks/${t.id}`, { method: 'PATCH', body: { status } }));
    const remove = (t: Task) => { if (confirm(`¿Eliminar "${t.title}"?`)) act(() => api(`/tasks/${t.id}`, { method: 'DELETE' })); };

    return (
        <>
            <PageHead title="Tareas">
                <label className="inline">Materia
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                        <option value="">Todas</option>
                        {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </label>
                <button className="btn primary" onClick={() => setEditing('new')}>Nueva tarea</button>
            </PageHead>
            <Err msg={tasks.error || subjects.error || actionError} />

            {editing && (
                <TaskForm
                    task={editing === 'new' ? undefined : editing}
                    subjects={subjects.data ?? []}
                    onCancel={() => setEditing(null)}
                    onSaved={() => { setEditing(null); tasks.reload(); }}
                />
            )}

            <div className="tabs" role="tablist">
                {TABS.map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                ))}
            </div>

            {tasks.data && !shown.length && (
                <Empty title={tab === 'OPEN' ? 'Nada pendiente' : 'Aún no terminas tareas'}>
                    {tab === 'OPEN' ? 'Crea una tarea o acepta las que la IA encuentre en tu correo.' : 'Cuando marques una tarea como terminada aparecerá aquí.'}
                </Empty>
            )}

            <ul className="list">
                {shown.map((t) => (
                    <li key={t.id}>
                        <ScoreChip task={t} />
                        <div className="grow">
                            <strong>{t.title}</strong>
                            <small>
                                {t.subject?.name ?? 'Sin materia'} · {t.weightPct}% · {hours(t.estimatedHours)} · {STATUS_LABEL[t.status]}
                                {t.source === 'EMAIL' && ' · desde el correo'}
                            </small>
                            {t.status !== 'DONE' && <small>{t.priorityReason}</small>}
                        </div>
                        <DueText iso={t.dueDate} />
                        <div className="row">
                            {t.status === 'DONE'
                                ? <button className="link" onClick={() => setStatus(t, 'PENDING')}>Reabrir</button>
                                : <button className="link" onClick={() => setStatus(t, 'DONE')}>Terminar</button>}
                            <button className="link" onClick={() => setEditing(t)}>Editar</button>
                            <button className="link danger" onClick={() => remove(t)}>Eliminar</button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}
