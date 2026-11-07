import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { mins } from '../lib/format';
import { Empty, Err, PageHead, useLoad } from '../components/ui';
import { Block, Plan as PlanT } from '../types';

const todayIso = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

// Plan de estudio del día: bloques con hora, duración e indicación de la IA
export default function Plan() {
    const [date, setDate] = useState(todayIso());
    const { data: plan, error, reload, setData } = useLoad(() => api<PlanT | null>(`/study-plan?date=${date}`), [date]);
    const [f, setF] = useState({ availableHours: '3', startTime: '18:00' });
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');

    const generate = async (e: FormEvent) => {
        e.preventDefault();
        if (plan && !confirm('Se reemplazará el plan de este día. ¿Continuar?')) return;
        setBusy(true);
        setActionError('');
        try {
            setData(await api<PlanT>('/study-plan/generate', { body: { date, availableHours: Number(f.availableHours), startTime: f.startTime } }));
        } catch (er) {
            setActionError((er as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const toggle = async (b: Block) => {
        setActionError('');
        try { await api(`/study-plan/blocks/${b.id}`, { method: 'PATCH', body: { done: !b.done } }); await reload(); }
        catch (er) { setActionError((er as Error).message); }
    };

    const total = plan?.blocks.reduce((s, b) => s + b.minutes, 0) ?? 0;
    const done = plan?.blocks.filter((b) => b.done).reduce((s, b) => s + b.minutes, 0) ?? 0;

    return (
        <>
            <PageHead title="Plan de estudio">
                <label className="inline">Día<input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
            </PageHead>
            <Err msg={error || actionError} />

            <form className="panel row wrap" onSubmit={generate}>
                <label>Horas disponibles
                    <input className="narrow" type="number" min={0.5} max={14} step={0.5} required value={f.availableHours} onChange={(e) => setF({ ...f, availableHours: e.target.value })} />
                </label>
                <label>Empiezo a las
                    <input type="time" required value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
                </label>
                <button className="btn primary" disabled={busy}>{busy ? 'Armando el plan…' : plan ? 'Rehacer plan' : 'Armar mi plan'}</button>
                <p className="muted grow">El tiempo se reparte según la prioridad de cada tarea, con descansos de 10 minutos.</p>
            </form>

            {plan === null && !error && (
                <Empty title="Todavía no hay plan para este día">Indica cuántas horas tienes y UneedT te dice qué hacer y en qué orden.</Empty>
            )}

            {plan && !plan.blocks.length && (
                <Empty title="No hay tareas para planear">Agrega tareas abiertas en <Link to="/tareas">Tareas</Link> y vuelve a armar el plan.</Empty>
            )}

            {plan && plan.blocks.length > 0 && (
                <>
                    <p className="muted">{mins(done)} de {mins(total)} completados</p>
                    <div className="progressbar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                    </div>
                    <ol className="timeline">
                        {plan.blocks.map((b) => (
                            <li key={b.id} className={b.done ? 'done' : ''}>
                                <time>{b.startTime}</time>
                                <div className="grow">
                                    <strong>{b.task.title}</strong>
                                    <small>{b.task.subject?.name ?? 'Sin materia'} · {mins(b.minutes)}</small>
                                    {b.note && <p>{b.note}</p>}
                                </div>
                                <label className="inline">
                                    <input type="checkbox" checked={b.done} onChange={() => toggle(b)} /> Hecho
                                </label>
                            </li>
                        ))}
                    </ol>
                </>
            )}
        </>
    );
}
