import { useState } from 'react';
import { api } from '../lib/api';
import { Err, PageHead, useLoad } from '../components/ui';
import { Summary } from '../types';

interface Survey { id: string; score: number; kind: 'BASELINE' | 'FOLLOWUP'; createdAt: string }

const SCALE = ['Nada', 'Poco', 'Algo', 'Bastante', 'Muchísimo'];

// Progreso: indicadores de la Matriz de Marco Lógico y encuesta de agobio (escala 1-5)
export default function Progress() {
    const summary = useLoad(() => api<Summary>('/analytics/summary'));
    const surveys = useLoad(() => api<Survey[]>('/surveys'));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const answer = async (score: number) => {
        setBusy(true);
        setError('');
        try { await api('/surveys', { body: { score } }); await Promise.all([summary.reload(), surveys.reload()]); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const s = summary.data;
    const last = surveys.data?.[surveys.data.length - 1];
    const answeredToday = last && new Date(last.createdAt).toDateString() === new Date().toDateString();

    return (
        <>
            <PageHead title="Progreso" />
            <Err msg={summary.error || surveys.error || error} />

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
                        <span>estudiadas en bloques del plan</span>
                    </div>
                </div>
            )}
            {s && <p className="muted">{s.tasks.done} de {s.tasks.total} tareas terminadas · {s.tasks.open} abiertas.</p>}

            <section className="panel">
                <h3>¿Qué tan agobiado te sientes hoy con tu carga académica?</h3>
                {answeredToday
                    ? <p>Gracias, hoy respondiste <strong>{last!.score} · {SCALE[last!.score - 1]}</strong>. Vuelve a responder en unos días.</p>
                    : (
                        <>
                            {!surveys.data?.length && <p className="muted">Tu primera respuesta será tu punto de partida para medir el cambio.</p>}
                            <div className="scale" role="group" aria-label="Nivel de agobio">
                                {SCALE.map((l, i) => (
                                    <button key={l} className="btn" disabled={busy} onClick={() => answer(i + 1)}>
                                        <strong>{i + 1}</strong><small>{l}</small>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                {!!surveys.data?.length && (
                    <small>
                        Respuestas: {surveys.data.map((v) => `${new Date(v.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}: ${v.score}`).join(' · ')}
                    </small>
                )}
            </section>
        </>
    );
}
