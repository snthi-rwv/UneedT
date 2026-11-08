import { useState } from 'react';
import { api } from '../lib/api';
import { mins } from '../lib/format';
import { clock, realSeconds, runningSeconds, STILL_THERE_S, timeTone } from '../lib/timer';
import { GuideResult, GuideStep, TaskWithGuide } from '../types';
import { DueText, ScoreChip } from './ui';

type Action = 'start' | 'pause' | 'finish' | 'undo' | 'adjust';
const TONE_MSG = { good: 'Vas a tiempo', warn: 'Cerca del tiempo planeado', bad: '' };

/**
 * Plan específico de una tarea, desplegable: paso a paso con casillas y cronómetro por paso.
 * El tiempo de los pasos se va sumando al total de la tarea, que se pinta en verde, amarillo o rojo.
 * Si la tarea todavía no tiene paso a paso, muestra los botones para crearlo.
 */
export default function TaskPlanCard({ task, open, highlight, nowMs, onToggle, onChange, onContext, onError, onTaskDone, onReplan, replanning }: {
    task: TaskWithGuide;
    open: boolean;
    highlight: boolean; // la tarea con la que llegó desde "Empezar"
    nowMs: number; // hora actual (corregida con el servidor)
    onToggle: () => void;
    onChange: (r: GuideResult, action?: Action) => void;
    onContext: () => void; // abre la ventana de contexto
    onError: (msg: string) => void;
    onTaskDone: () => void;
    onReplan: () => void;
    replanning: boolean;
}) {
    const [busy, setBusy] = useState('');
    const [optimistic, setOptimistic] = useState<Record<string, boolean>>({}); // la casilla cambia al instante
    const [stillThere, setStillThere] = useState<Record<string, number>>({}); // cuándo confirmó "sí, sigo"
    const g = task.guide;
    const steps = g?.steps ?? [];
    const isDone = (s: GuideStep) => optimistic[s.id] ?? s.done;
    const doneCount = steps.filter(isDone).length;
    const plannedSec = steps.reduce((n, s) => n + s.minutes * 60, 0);
    const realSec = steps.reduce((n, s) => n + realSeconds(s, nowMs), 0);
    const tone = timeTone(realSec, plannedSec);
    const running = steps.find((s) => s.runningSince);
    const allDone = steps.length > 0 && doneCount === steps.length;

    const run = async (key: string, fn: () => Promise<GuideResult | void>, action?: Action) => {
        setBusy(key);
        try {
            const r = await fn();
            if (r) onChange(r, action);
        } catch (e) {
            onError((e as Error).message);
        } finally {
            setBusy('');
        }
    };
    const regenerate = () => run('gen', () => api<GuideResult>(`/guides/${task.id}`, { body: new FormData() }));
    const act = (s: GuideStep, action: Action, minutes?: number) =>
        run(s.id + action, () => api<GuideResult>(`/guides/steps/${s.id}`, { method: 'PATCH', body: { action, ...(minutes !== undefined && { minutes }) } }), action);

    const toggleStep = async (s: GuideStep) => {
        setOptimistic((o) => ({ ...o, [s.id]: !s.done }));
        await act(s, s.done ? 'undo' : 'finish');
        setOptimistic((o) => { const { [s.id]: _, ...rest } = o; return rest; }); // manda lo que diga el servidor
    };
    const adjust = (s: GuideStep) => {
        const answer = window.prompt(`¿Cuántos minutos le dedicaste de verdad a "${s.title}"?`, String(Math.round(realSeconds(s, nowMs) / 60)));
        if (answer === null) return;
        const n = Number(answer.trim());
        if (!Number.isInteger(n) || n < 0 || n > 600) return onError('Escribe un número entero de minutos, entre 0 y 600.');
        act(s, 'adjust', n);
    };
    const finishTask = () => run('done', async () => {
        await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status: 'DONE' } });
        onTaskDone();
    });

    return (
        <article id={`tp-${task.id}`} className={`tplan${open ? ' open' : ''}${highlight ? ' focus' : ''}`}>
            <button type="button" className="tplan-head" onClick={onToggle} aria-expanded={open}>
                <ScoreChip task={task} />
                <span className="grow">
                    <strong>{task.title}</strong>
                    <small>
                        {task.status === 'IN_PROGRESS' && <em className="badge">En curso</em>}
                        {highlight && <em className="badge hl">Empezaste aquí</em>}
                        <DueText iso={task.dueDate} />
                    </small>
                </span>
                <span className="tplan-sum">
                    {running ? <span className={`clock live ${tone}`}>{clock(realSec)}</span> : g ? <>{doneCount}/{steps.length} pasos</> : null}
                    <small>{g ? (running ? `de ${mins(plannedSec / 60)}` : mins(plannedSec / 60)) : 'Sin paso a paso'}</small>
                </span>
                <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
            </button>

            {open && (
                <div className="tplan-body">
                    {!g && (
                        <>
                            <p className="muted">Esta tarea todavía no tiene un paso a paso. Con contexto (los temas, la rúbrica o el correo del profesor) la IA lo arma a tu medida.</p>
                            <div className="row">
                                <button type="button" className="btn primary" onClick={onContext} disabled={!!busy}>Añadir contexto</button>
                                <button type="button" className="btn" onClick={regenerate} disabled={!!busy}>{busy === 'gen' ? 'Armando pasos…' : 'Generar sin contexto'}</button>
                            </div>
                        </>
                    )}

                    {g && (
                        <>
                            {g.summary && <p className="note">{g.summary}</p>}
                            {!g.usedAi && <p className="muted small">Son pasos generales porque la IA no estuvo disponible. Puedes rehacerlos más tarde.</p>}
                            {(g.context || g.sourceName) && (
                                <p className="tplan-ctx">
                                    {g.sourceName && <span className="file-tag">{g.sourceName}</span>}
                                    {g.context && <span>“{g.context.length > 160 ? g.context.slice(0, 160) + '…' : g.context}”</span>}
                                </p>
                            )}

                            {/* Tiempo total de la tarea: suma de los pasos, comparado con lo planeado */}
                            <div className={`ttime ${tone}`}>
                                <div className="ttime-top">
                                    <span className="ttime-label">Tiempo de la tarea</span>
                                    <strong className="clock">{clock(realSec)}</strong>
                                    <span className="muted">de {mins(plannedSec / 60)}</span>
                                    <span className="ttime-msg">
                                        {realSec === 0 ? 'Aún no empiezas' : tone === 'bad' ? `Te pasaste ${mins(Math.ceil((realSec - plannedSec) / 60))}` : TONE_MSG[tone]}
                                    </span>
                                </div>
                                <div className="progressbar" role="progressbar" aria-label="Tiempo usado frente al planeado" aria-valuemin={0} aria-valuemax={plannedSec} aria-valuenow={Math.round(Math.min(realSec, plannedSec))}>
                                    <i style={{ width: `${plannedSec ? Math.min(realSec / plannedSec, 1) * 100 : 0}%` }} />
                                </div>
                                {tone === 'bad' && (
                                    <div className="ttime-alert">
                                        <span>Esta tarea te está tomando más de lo planeado. Replantea el plan para repartir el tiempo que te queda hoy según tu ritmo real.</span>
                                        <button type="button" className="btn primary small-btn" onClick={onReplan} disabled={replanning}>{replanning ? 'Replanteando…' : 'Replantear plan'}</button>
                                    </div>
                                )}
                            </div>

                            <ol className="steps">
                                {steps.map((s, i) => {
                                    const done = isDone(s);
                                    const real = realSeconds(s, nowMs);
                                    const stone = timeTone(real, s.minutes * 60);
                                    const seg = runningSeconds(s, nowMs);
                                    const askStill = s.runningSince && seg > STILL_THERE_S && (!stillThere[s.id] || nowMs - stillThere[s.id] > STILL_THERE_S * 1000);
                                    return (
                                        <li key={s.id} className={`${done ? 'done' : ''}${s.runningSince ? ' running' : ''}`}>
                                            <label className="step-check">
                                                <input type="checkbox" checked={done} disabled={busy.startsWith(s.id)} onChange={() => toggleStep(s)} aria-label={`Paso ${i + 1}: ${s.title}`} />
                                            </label>
                                            <div className="grow">
                                                <strong>{s.title}</strong>
                                                {s.detail && <p>{s.detail}</p>}

                                                {!done && (
                                                    <div className="step-timer">
                                                        {(s.runningSince || real > 0) && (
                                                            <span className={`clock ${stone}`}>{clock(real)}<small> / {mins(s.minutes)}</small></span>
                                                        )}
                                                        {s.runningSince
                                                            ? <button type="button" className="btn tiny" onClick={() => act(s, 'pause')} disabled={!!busy}>Pausar</button>
                                                            : <button type="button" className="btn tiny" onClick={() => act(s, 'start')} disabled={!!busy}>{real > 0 ? 'Seguir' : 'Iniciar'}</button>}
                                                        <button type="button" className="btn tiny primary" onClick={() => act(s, 'finish')} disabled={!!busy}>Terminé</button>
                                                        {real > 0 && !s.runningSince && <button type="button" className="link small" onClick={() => adjust(s)}>Corregir tiempo</button>}
                                                    </div>
                                                )}
                                                {done && s.spentSeconds > 0 && (
                                                    <p className="step-took">
                                                        <span className={`clock ${stone}`}>Tomó {mins(Math.max(1, Math.round(s.creditedSeconds / 60)))}</span> de {mins(s.minutes)}
                                                        {' · '}<button type="button" className="link small" onClick={() => adjust(s)}>Corregir</button>
                                                    </p>
                                                )}

                                                {askStill && (
                                                    <div className="still" role="alert">
                                                        <span>Llevas más de 2 horas con el cronómetro corriendo. ¿Sigues estudiando?</span>
                                                        <button type="button" className="btn tiny" onClick={() => setStillThere((m) => ({ ...m, [s.id]: nowMs }))}>Sí, sigo</button>
                                                        <button type="button" className="btn tiny" onClick={() => adjust(s)}>Lo dejé corriendo: corregir</button>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="step-min">{mins(s.minutes)}</span>
                                        </li>
                                    );
                                })}
                            </ol>

                            <div className="row">
                                {allDone && <button type="button" className="btn primary" onClick={finishTask} disabled={!!busy}>{busy === 'done' ? 'Guardando…' : 'Marcar la tarea como terminada'}</button>}
                                <button type="button" className="btn" onClick={onContext} disabled={!!busy}>{g.context || g.sourceName ? 'Actualizar contexto' : 'Añadir contexto'}</button>
                                {!allDone && (
                                    <button type="button" className="btn" disabled={!!busy} title="Los pasos hechos se conservan"
                                        onClick={() => { if (confirm('Se reemplazarán los pasos pendientes (los hechos se conservan). ¿Continuar?')) regenerate(); }}>
                                        {busy === 'gen' ? 'Armando pasos…' : 'Rehacer pasos'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </article>
    );
}
