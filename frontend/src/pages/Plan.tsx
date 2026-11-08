import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { mins } from '../lib/format';
import { clock, realSeconds, timeTone, useNow } from '../lib/timer';
import ContextDialog from '../components/ContextDialog';
import TaskPlanCard from '../components/TaskPlanCard';
import { notifyStudy } from '../components/StreakBadge';
import { Empty, Err, PageHead, useLoad } from '../components/ui';
import { Block, GuideList, GuideResult, Intensity, Plan as PlanT, TaskWithGuide } from '../types';

const todayIso = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
const INTENSITIES: [Intensity, string, string][] = [
    ['LIGHT', 'Suave', 'Bloques de 25 min, descansos de 5'],
    ['NORMAL', 'Normal', 'Bloques de 45 min, descansos de 10'],
    ['INTENSE', 'Intensa', 'Bloques de 60 min, descansos de 10'],
];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * En el plan general cada tarea aparece una sola vez, aunque la intensidad la parta en varios bloques con descansos.
 * Se agrupan sus bloques y se muestra de qué hora a qué hora va, cuánto tiempo suma y en cuántos bloques.
 */
function groupByTask(blocks: Block[]) {
    const groups = new Map<string, Block[]>();
    for (const b of blocks) groups.set(b.taskId, [...(groups.get(b.taskId) ?? []), b]);
    return [...groups.values()].map((bs) => {
        const last = bs[bs.length - 1];
        return {
            taskId: bs[0].taskId,
            task: bs[0].task,
            blocks: bs,
            note: bs.find((b) => b.note)?.note ?? '',
            start: bs[0].startTime,
            end: hhmm(toMin(last.startTime) + last.minutes),
            minutes: bs.reduce((n, b) => n + b.minutes, 0),
            allDone: bs.every((b) => b.done),
            someDone: bs.some((b) => b.done),
        };
    });
}

// Tareas agrupadas por materia; los grupos van en el orden de su tarea más prioritaria
function bySubject(tasks: TaskWithGuide[]) {
    const groups = new Map<string, { name: string; color: string; tasks: TaskWithGuide[] }>();
    for (const t of tasks) {
        const key = t.subject?.id ?? '';
        if (!groups.has(key)) groups.set(key, { name: t.subject?.name ?? 'Sin materia', color: t.subject?.color ?? 'var(--line)', tasks: [] });
        groups.get(key)!.tasks.push(t);
    }
    return [...groups.values()];
}

// Plan de estudio: arriba el plan general del día; abajo el paso a paso de cada tarea
export default function Plan() {
    const [params] = useSearchParams();
    const focusId = params.get('tarea'); // llega desde el botón "Empezar"
    const [date, setDate] = useState(todayIso());
    const { data: plan, error, reload, setData } = useLoad(() => api<PlanT | null>(`/study-plan?date=${date}`), [date]);
    const guides = useLoad(() => api<GuideList>('/guides'));
    const [f, setF] = useState({ availableHours: '3', startTime: '18:00', intensity: 'NORMAL' as Intensity });
    const [busy, setBusy] = useState('');
    const [actionError, setActionError] = useState('');
    const [notice, setNotice] = useState('');
    const [openId, setOpenId] = useState<string | null>(focusId);
    const [dialogFor, setDialogFor] = useState<TaskWithGuide | null>(null);
    const [offset, setOffset] = useState(0); // diferencia entre el reloj del servidor y el del navegador

    useEffect(() => {
        if (guides.data?.now) setOffset(Date.parse(guides.data.now) - Date.now());
    }, [guides.data?.now]);

    // El formulario muestra la configuración del plan que ya existe para ese día
    useEffect(() => {
        if (plan) setF({ availableHours: String(plan.availableHours), startTime: plan.startTime, intensity: plan.intensity });
    }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const tasks = guides.data?.tasks ?? [];
    const focusTask = tasks.find((t) => t.id === focusId);
    // El cronómetro que esté corriendo (solo puede haber uno)
    const runningTask = tasks.find((t) => t.guide?.steps.some((s) => s.runningSince));
    const runningStep = runningTask?.guide?.steps.find((s) => s.runningSince);
    const nowMs = useNow(!!runningStep, offset);
    const slots = useMemo(() => groupByTask(plan?.blocks ?? []), [plan]);

    const generate = async (e: FormEvent) => {
        e.preventDefault();
        if (plan && !confirm('Se reemplazará el plan de este día. ¿Continuar?')) return;
        setBusy('gen');
        setActionError('');
        try {
            setData(await api<PlanT>('/study-plan/generate', {
                body: { date, availableHours: Number(f.availableHours), startTime: f.startTime, intensity: f.intensity },
            }));
        } catch (er) {
            setActionError((er as Error).message);
        } finally {
            setBusy('');
        }
    };

    const replan = async () => {
        setBusy('replan');
        setActionError('');
        try {
            setData(await api<PlanT>('/study-plan/replan', { body: { date } }));
            setNotice('Replanteamos el plan con el tiempo que te queda y tu ritmo real.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (er) {
            setActionError((er as Error).message);
        } finally {
            setBusy('');
        }
    };

    // "Hecho" marca (o desmarca) todos los bloques de esa tarea
    const toggle = async (blocks: Block[], allDone: boolean) => {
        setActionError('');
        try {
            for (const b of blocks.filter((x) => x.done === allDone)) {
                await api(`/study-plan/blocks/${b.id}`, { method: 'PATCH', body: { done: !allDone } });
            }
            await reload();
            notifyStudy();
        } catch (er) {
            setActionError((er as Error).message);
            reload();
        }
    };

    // Cuando cambia el plan de una tarea, se actualiza solo esa tarjeta (y el plan general si se recalculó)
    const onGuide = (r: GuideResult, action?: string) => {
        guides.setData((d) => d && { ...d, now: r.now, tasks: d.tasks.map((t) => (t.id === r.task.id ? r.task : t)) });
        if (action === 'start') guides.reload(); // al iniciar un cronómetro, el servidor pausa el que estuviera corriendo en otra tarea
        if (action && action !== 'start') notifyStudy(); // pausar, terminar o corregir cambia el tiempo de hoy: se actualiza la racha
        if (r.replanned) { reload(); setNotice('Paso a paso listo. Como cambió el tiempo que necesita la tarea, también recalculamos tu plan de hoy.'); }
    };

    // Abre la tarjeta de una tarea y la trae a la vista
    const goToTask = (id: string) => {
        setOpenId(id);
        requestAnimationFrame(() => document.getElementById(`tp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    const total = plan?.blocks.reduce((s, b) => s + b.minutes, 0) ?? 0;
    const done = plan?.blocks.filter((b) => b.done).reduce((s, b) => s + b.minutes, 0) ?? 0;

    return (
        <>
            <PageHead title="Plan de estudio">
                <label className="inline">Día<input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
            </PageHead>
            <Err msg={error || guides.error || actionError} />

            {focusTask && (
                <p className="note">
                    Empezaste <strong>{focusTask.title}</strong>. Arma tu plan del día y sigue su paso a paso más abajo.{' '}
                    <button type="button" className="link" onClick={() => goToTask(focusTask.id)}>Ver su paso a paso</button>
                </p>
            )}
            {notice && <p className="note ok" role="status">{notice} <button type="button" className="link" onClick={() => setNotice('')}>Entendido</button></p>}

            <form className="panel plan-form" onSubmit={generate}>
                <div className="row wrap">
                    <label>Horas libres
                        <input className="narrow" type="number" min={0.5} max={14} step={0.5} required value={f.availableHours} onChange={(e) => setF({ ...f, availableHours: e.target.value })} />
                    </label>
                    <label>Empiezo a las
                        <input type="time" required value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
                    </label>
                </div>
                <fieldset className="field">
                    <legend>Intensidad</legend>
                    <div className="seg seg-3" role="radiogroup">
                        {INTENSITIES.map(([value, label, hint]) => (
                            <label key={value} className={f.intensity === value ? 'on' : ''}>
                                <input type="radio" name="intensity" value={value} checked={f.intensity === value} onChange={() => setF({ ...f, intensity: value })} />
                                <b>{label}</b><span>{hint}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <p className="muted small plan-hint">El tiempo se reparte según la prioridad de cada tarea, en bloques con descansos. Si una tarea tiene paso a paso, lo abres desde el plan general.</p>
                <div><button className="btn primary" disabled={!!busy}>{busy === 'gen' ? 'Armando el plan…' : plan ? 'Rehacer plan' : 'Armar mi plan'}</button></div>
            </form>

            {plan === null && !error && (
                <Empty title="Todavía no hay plan para este día">Indica cuántas horas tienes y UneedT te dice qué hacer y en qué orden.</Empty>
            )}

            {plan && !plan.blocks.length && (
                <Empty title="No hay tareas para planear">Agrega tareas abiertas en <Link to="/tareas">Tareas</Link> y vuelve a armar el plan.</Empty>
            )}

            {plan && plan.blocks.length > 0 && (
                <section aria-labelledby="general-title">
                    <div className="sec-head">
                        <h3 id="general-title">Plan general</h3>
                        <span className="muted small">{mins(done)} de {mins(total)} · hasta las {plan.endTime || '—'}</span>
                        <button type="button" className="btn small-btn" onClick={replan} disabled={!!busy} title="Reparte de nuevo el tiempo que te queda hoy">
                            {busy === 'replan' ? 'Replanteando…' : 'Replantear'}
                        </button>
                    </div>
                    <div className="progressbar" role="progressbar" aria-label="Tiempo completado" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                    </div>
                    <ol className="timeline">
                        {slots.map((g) => {
                            const guide = tasks.find((t) => t.id === g.taskId)?.guide;
                            const pending = guide?.steps.filter((st) => !st.done) ?? [];
                            return (
                                <li key={g.taskId} className={g.allDone ? 'done' : ''}>
                                    <time>{g.start}<small>a {g.end}</small></time>
                                    <div className="grow">
                                        <strong>{g.task.title}</strong>
                                        <small>
                                            {g.task.subject?.name ?? 'Sin materia'} · {mins(g.minutes)}
                                            {g.blocks.length > 1 && ` en ${g.blocks.length} bloques con descansos`}
                                        </small>
                                        {guide ? (
                                            <p className="block-steps">
                                                <button type="button" className="link" onClick={() => goToTask(g.taskId)}>Pasos de esta tarea</button>
                                                {pending.length
                                                    ? <>: sigue con <strong>{pending[0].title}</strong>{pending.length > 1 && ` y ${pending.length - 1} más`}</>
                                                    : ': ya completaste todos'}
                                            </p>
                                        ) : g.note && <p>{g.note}</p>}
                                    </div>
                                    <label className="inline">
                                        <input type="checkbox" checked={g.allDone} ref={(el) => { if (el) el.indeterminate = g.someDone && !g.allDone; }}
                                            onChange={() => toggle(g.blocks, g.allDone)} /> Hecho
                                    </label>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            )}

            <section aria-labelledby="specific-title">
                <h3 id="specific-title">Paso a paso por tarea</h3>
                <p className="muted small">Elige una tarea para ver su plan específico. Si no tiene uno, añádele contexto o genéralo con lo que ya sabemos de ella.</p>
                {guides.data && !tasks.length && <Empty title="No tienes tareas abiertas">Cuando agregues tareas, aquí verás su paso a paso.</Empty>}
                {bySubject(tasks).map((g) => (
                    <div key={g.name} className="subject-group">
                        <h4><i className="dot" style={{ background: g.color }} /> {g.name}</h4>
                        {g.tasks.map((t) => (
                            <TaskPlanCard
                                key={t.id}
                                task={t}
                                open={openId === t.id}
                                highlight={t.id === focusId}
                                onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                                onChange={onGuide}
                                onContext={() => setDialogFor(t)}
                                onError={setActionError}
                                onTaskDone={() => { guides.reload(); reload(); }}
                                nowMs={nowMs}
                                onReplan={replan}
                                replanning={busy === 'replan'}
                            />
                        ))}
                    </div>
                ))}
            </section>

            {/* Cronómetro pequeño: siempre a la vista mientras corre */}
            {runningTask && runningStep && (() => {
                const real = realSeconds(runningStep, nowMs);
                const tone = timeTone(real, runningStep.minutes * 60);
                const act = (action: 'pause' | 'finish') =>
                    api<GuideResult>(`/guides/steps/${runningStep.id}`, { method: 'PATCH', body: { action } }).then((r) => onGuide(r, action)).catch((e) => setActionError(e.message));
                return (
                    <>
                    <div className="mini-spacer" aria-hidden="true" />
                    <div className={`mini-timer ${tone}`} role="timer" aria-label={`Cronómetro de ${runningStep.title}`}>
                        <i className="mini-dot" aria-hidden="true" />
                        <button type="button" className="mini-title" onClick={() => goToTask(runningTask.id)}>{runningStep.title}</button>
                        <span className="mini-clock">{clock(real)}<small> / {mins(runningStep.minutes)}</small></span>
                        <button type="button" className="btn tiny" onClick={() => act('pause')}>Pausar</button>
                        <button type="button" className="btn tiny primary" onClick={() => act('finish')}>Terminé</button>
                    </div>
                    </>
                );
            })()}

            {dialogFor && (
                <ContextDialog
                    task={dialogFor}
                    guide={dialogFor.guide}
                    mode="context"
                    onClose={() => setDialogFor(null)}
                    onDone={(r) => { setDialogFor(null); if (r) { onGuide(r); setOpenId(r.task.id); } }}
                />
            )}
        </>
    );
}
