import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ProgressCharts, { CHECKIN_QUESTIONS } from '../components/ProgressCharts';
import { Err, PageHead, useLoad } from '../components/ui';
import { StudyDayPoint, Summary, Survey } from '../types';

const QUESTION_TEXT = {
    score: '¿Qué tan agobiado te sientes hoy con tu carga académica?',
    concentration: '¿Cómo estuvo tu concentración hoy?',
    performance: '¿Cómo sentiste tu rendimiento hoy?',
} as const;
type Answers = { score: number | null; concentration: number | null; performance: number | null };
const RANGES = [[14, '2 semanas'], [30, '30 días'], [90, '3 meses']] as const;

// Progreso: indicadores de la Matriz de Marco Lógico, encuesta diaria (agobio, concentración, rendimiento) y su evolución
export default function Progress() {
    const [range, setRange] = useState<number>(30);
    const summary = useLoad(() => api<Summary>('/analytics/summary'));
    const surveys = useLoad(() => api<Survey[]>('/surveys'));
    const days = useLoad(() => api<StudyDayPoint[]>(`/activity/days?days=${range}`), [range]);
    const [answers, setAnswers] = useState<Answers>({ score: null, concentration: null, performance: null });
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const last = surveys.data?.[surveys.data.length - 1];
    const answeredToday = !!last && new Date(last.createdAt).toDateString() === new Date().toDateString();

    // Si ya respondió hoy, la encuesta muestra sus respuestas (y se pueden cambiar)
    useEffect(() => {
        if (answeredToday && last) setAnswers({ score: last.score, concentration: last.concentration, performance: last.performance });
    }, [last?.id, last?.score, last?.concentration, last?.performance]); // eslint-disable-line react-hooks/exhaustive-deps

    const complete = answers.score != null && answers.concentration != null && answers.performance != null;
    const save = async () => {
        if (!complete) return setError('Responde las tres preguntas.');
        setBusy(true);
        setError('');
        try {
            await api('/surveys', { body: answers });
            await Promise.all([summary.reload(), surveys.reload()]);
            setEditing(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const s = summary.data;
    const showForm = !answeredToday || editing;

    return (
        <>
            <PageHead title="Progreso" />
            <Err msg={summary.error || surveys.error || days.error || error} />

            {s && (
                <div className="stats big">
                    <div className={s.criticalOnTimePct != null && s.criticalOnTimePct < 80 ? 'warn' : ''}>
                        <b>{s.criticalOnTimePct != null ? `${s.criticalOnTimePct}%` : '—'}</b>
                        <span>tareas críticas entregadas a tiempo (meta: 80 %)</span>
                    </div>
                    <div>
                        <b>{s.stress.delta != null ? (s.stress.delta > 0 ? `+${s.stress.delta}` : s.stress.delta) : '—'}</b>
                        <span>cambio en tu agobio desde la primera respuesta (meta: −1)</span>
                    </div>
                    <div>
                        <b>{s.emailCapturedPct}%</b>
                        <span>tareas que llegaron desde el correo</span>
                    </div>
                    <div>
                        <b>{s.hoursStudied} h</b>
                        <span>estudiadas en total</span>
                    </div>
                </div>
            )}
            {s && <p className="muted">{s.tasks.done} de {s.tasks.total} tareas terminadas · {s.tasks.open} abiertas.</p>}

            <section className="panel checkin">
                <div className="checkin-head">
                    <h3>¿Cómo vas hoy?</h3>
                    {answeredToday && !editing && <button type="button" className="link" onClick={() => setEditing(true)}>Cambiar mis respuestas</button>}
                </div>
                {!surveys.data?.length && <p className="muted small">Tu primera respuesta será tu punto de partida para medir el cambio.</p>}
                {showForm ? (
                    <>
                        {CHECKIN_QUESTIONS.map((q) => (
                            <fieldset key={q.key} className="field">
                                <legend>{QUESTION_TEXT[q.key]}</legend>
                                <div className="seg seg-5" role="radiogroup">
                                    {q.scale.map((label, i) => (
                                        <label key={label} className={answers[q.key] === i + 1 ? 'on' : ''}>
                                            <input type="radio" name={q.key} value={i + 1} checked={answers[q.key] === i + 1} disabled={busy}
                                                onChange={() => setAnswers((a) => ({ ...a, [q.key]: i + 1 }))} />
                                            <b>{i + 1}</b><span>{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                        <div className="row">
                            <button type="button" className="btn primary" onClick={save} disabled={busy || !complete}>{busy ? 'Guardando…' : 'Guardar mi día'}</button>
                            {editing && <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>Cancelar</button>}
                        </div>
                    </>
                ) : (
                    <ul className="checkin-done">
                        {CHECKIN_QUESTIONS.map((q) => {
                            const v = last?.[q.key];
                            return <li key={q.key}><span>{q.name}</span><strong>{v != null ? `${v} · ${q.scale[v - 1]}` : '—'}</strong></li>;
                        })}
                    </ul>
                )}
            </section>

            <section className="panel" aria-labelledby="evol-title">
                <div className="checkin-head">
                    <h3 id="evol-title">Tu evolución</h3>
                    <div className="range" role="radiogroup" aria-label="Periodo">
                        {RANGES.map(([d, label]) => (
                            <button key={d} type="button" role="radio" aria-checked={range === d} className={range === d ? 'on' : ''} onClick={() => setRange(d)}>{label}</button>
                        ))}
                    </div>
                </div>
                {surveys.data && days.data && <ProgressCharts surveys={surveys.data} days={days.data} />}
            </section>
        </>
    );
}
