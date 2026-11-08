import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, DATA_CHANGED } from '../lib/api';
import { Streak } from '../types';

export const STUDY_EVENT = 'uneedt:study'; // se lanza cuando el estudiante registra tiempo (cronómetro, pasos, bloques)
export const notifyStudy = () => window.dispatchEvent(new Event(STUDY_EVENT));

/**
 * Racha de estudio: días seguidos con al menos 15 minutos de estudio.
 * El aro se va llenando con los minutos de hoy; cuando llega a la meta, el día cuenta.
 */
export default function StreakBadge() {
    const [s, setS] = useState<Streak | null>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        let alive = true;
        const load = () => api<Streak>('/activity/streak').then((r) => alive && setS(r)).catch(() => undefined);
        load();
        window.addEventListener(STUDY_EVENT, load);
        window.addEventListener(DATA_CHANGED, load);
        return () => { alive = false; window.removeEventListener(STUDY_EVENT, load); window.removeEventListener(DATA_CHANGED, load); };
    }, [pathname]);

    if (!s) return null;
    const progress = Math.min(s.todayMinutes / s.goalMinutes, 1);
    const R = 19, C = 2 * Math.PI * R;
    const hint = s.studiedToday
        ? 'Hoy ya cuenta para tu racha'
        : `Hoy: ${s.todayMinutes} de ${s.goalMinutes} min${s.current ? ' para no perderla' : ''}`;
    const label = `Racha de ${s.current} día${s.current === 1 ? '' : 's'}. ${hint}. Mejor racha: ${s.best} día${s.best === 1 ? '' : 's'}.`;

    return (
        <div className={`streak${s.studiedToday ? ' lit' : ''}`} role="status" aria-label={label} title={label}>
            <span className="streak-ring">
                <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
                    <circle cx="22" cy="22" r={R} className="ring-bg" />
                    <circle cx="22" cy="22" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
                </svg>
                <b>{s.current}</b>
            </span>
            <span className="streak-text">
                <strong>
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M12 2c1 3.5-1.5 5-1.5 7.5A2.5 2.5 0 0 0 13 12c1.6 0 2.5-1.3 2.3-3C18 10.6 19 13.3 19 15a7 7 0 1 1-14 0c0-4.2 3.8-6.6 4.6-10.2.9 1 1.4 2 1.4 3.2C11 6 12 4.3 12 2Z" /></svg>
                    {s.current} día{s.current === 1 ? '' : 's'} de racha
                </strong>
                <small>{hint}</small>
            </span>
        </div>
    );
}
