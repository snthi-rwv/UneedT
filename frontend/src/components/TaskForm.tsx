import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { toInputDate } from '../lib/format';
import { Subject, Task } from '../types';
import { Err } from './ui';

// Formulario para crear o editar una tarea. Los campos son los que usa el cálculo de prioridad.
export default function TaskForm({ task, subjects, onSaved, onCancel }: {
    task?: Task; subjects: Subject[]; onSaved: (t: Task) => void; onCancel: () => void;
}) {
    const [f, setF] = useState({
        title: task?.title ?? '',
        description: task?.description ?? '',
        subjectId: task?.subjectId ?? '',
        dueDate: toInputDate(task?.dueDate) || toInputDate(new Date(Date.now() + 3 * 86_400_000).toISOString()),
        weightPct: String(task?.weightPct ?? 10),
        complexity: String(task?.complexity ?? 3),
        estimatedHours: String(task?.estimatedHours ?? 2),
    });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const body = {
            title: f.title.trim(),
            description: f.description.trim() || undefined,
            subjectId: f.subjectId || (task ? null : undefined),
            dueDate: new Date(f.dueDate).toISOString(),
            weightPct: Number(f.weightPct),
            complexity: Number(f.complexity),
            estimatedHours: Number(f.estimatedHours),
        };
        try {
            onSaved(await api<Task>(task ? `/tasks/${task.id}` : '/tasks', { method: task ? 'PATCH' : 'POST', body }));
        } catch (er) {
            setError((er as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="panel grid" onSubmit={submit}>
            <h3>{task ? 'Editar tarea' : 'Nueva tarea'}</h3>
            <label className="span2">Título<input required minLength={2} maxLength={160} value={f.title} onChange={set('title')} /></label>
            <label>Materia
                <select value={f.subjectId} onChange={set('subjectId')}>
                    <option value="">Sin materia</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </label>
            <label>Fecha de entrega<input required type="datetime-local" value={f.dueDate} onChange={set('dueDate')} /></label>
            <label>Peso en la nota (%)<input required type="number" min={0} max={100} step="any" value={f.weightPct} onChange={set('weightPct')} /></label>
            <label>Complejidad
                <select value={f.complexity} onChange={set('complexity')}>
                    {['1 · Muy fácil', '2 · Fácil', '3 · Media', '4 · Difícil', '5 · Muy difícil'].map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
                </select>
            </label>
            <label>Horas estimadas<input required type="number" min={0.25} max={100} step={0.25} value={f.estimatedHours} onChange={set('estimatedHours')} /></label>
            <label className="span2">Descripción (opcional)<textarea rows={2} maxLength={2000} value={f.description} onChange={set('description')} /></label>
            <div className="span2"><Err msg={error} /></div>
            <div className="row span2">
                <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
                <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
            </div>
        </form>
    );
}
