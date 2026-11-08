import { useEffect, useMemo, useRef, useState } from 'react';
import { Task } from '../types';
import { hours } from '../lib/format';
import { priorityLevel, ScoreChip } from './ui';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STATUS: Record<Task['status'], string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', DONE: 'Terminada' };
const MAX_DOTS = 3; // más de esto se resume como "+N" para no saturar la celda

// Clave de un día en hora local, p. ej. "2026-11-09"
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Color del círculo: el mismo semáforo del puntaje; las terminadas van aparte
const dotLevel = (t: Task) => (t.status === 'DONE' ? 'done' : priorityLevel(t.priorityScore));

/**
 * Calendario mensual de entregas. Cada tarea es un círculo en su día de entrega.
 * Al tocar un día, la vista de mes se reemplaza por ese día con el detalle de sus tareas.
 */
export default function MonthCalendar({ tasks }: { tasks: Task[] }) {
    const today = dayKey(new Date());
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [day, setDay] = useState<string | null>(null);

    // Tareas por día: primero las abiertas de mayor puntaje; las terminadas al final
    const byDay = useMemo(() => {
        const m = new Map<string, Task[]>();
        for (const t of tasks) {
            const k = dayKey(new Date(t.dueDate));
            m.set(k, [...(m.get(k) ?? []), t]);
        }
        for (const list of m.values()) list.sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE') || b.priorityScore - a.priorityScore);
        return m;
    }, [tasks]);

    const openDay = (k: string) => { const d = fromKey(k); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(k); };

    if (day) {
        const d = fromKey(day);
        return (
            <DayView
                date={d}
                tasks={byDay.get(day) ?? []}
                onBack={() => setDay(null)}
                onShift={(n) => openDay(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)))}
            />
        );
    }

    // Celdas del mes (la semana empieza el lunes): huecos al inicio y al final para completar filas
    const y = month.getFullYear(), m = month.getMonth();
    const lead = (month.getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(y, m, i + 1))];
    while (cells.length % 7) cells.push(null);
    const isThisMonth = dayKey(month).slice(0, 7) === today.slice(0, 7);
    const title = cap(month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));

    return (
        <section className="cal" aria-label={`Calendario de entregas, ${title}`}>
            <div className="cal-head">
                <h4 aria-live="polite">{title}</h4>
                {!isThisMonth && <button type="button" className="btn cal-today" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Hoy</button>}
                <button type="button" className="cal-nav" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label="Mes anterior">‹</button>
                <button type="button" className="cal-nav" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Mes siguiente">›</button>
            </div>

            <div className="cal-grid">
                {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
                {cells.map((c, i) => {
                    if (!c) return <div key={`x${i}`} className="cal-day empty" aria-hidden="true" />;
                    const k = dayKey(c);
                    const list = byDay.get(k) ?? [];
                    const cls = `cal-day${k === today ? ' today' : ''}${k < today ? ' past' : ''}`;
                    const num = <span className="cal-num">{c.getDate()}</span>;
                    if (!list.length) return <div key={k} className={cls}>{num}</div>;
                    return (
                        <button key={k} type="button" className={`${cls} has`} onClick={() => openDay(k)}
                            aria-label={`${c.getDate()} de ${c.toLocaleDateString('es-CO', { month: 'long' })}: ${list.length} entrega${list.length === 1 ? '' : 's'}. Ver detalle`}>
                            {num}
                            <span className="cal-dots" aria-hidden="true">
                                {list.slice(0, MAX_DOTS).map((t) => <i key={t.id} className={`cal-dot ${dotLevel(t)}`} />)}
                                {list.length > MAX_DOTS && <span className="cal-more">+{list.length - MAX_DOTS}</span>}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="cal-legend" aria-hidden="true">
                <span><i className="cal-dot hi" /> Alta (65+)</span>
                <span><i className="cal-dot mid" /> Media (40–64)</span>
                <span><i className="cal-dot lo" /> Baja</span>
                <span><i className="cal-dot done" /> Terminada</span>
            </div>
        </section>
    );
}

// Vista de un día: reemplaza al mes y muestra cada tarea con sus datos básicos
function DayView({ date, tasks, onBack, onShift }: { date: Date; tasks: Task[]; onBack: () => void; onShift: (n: number) => void }) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, [date.getTime()]); // lleva el foco al día abierto (lectores de pantalla y teclado)

    return (
        <section className="cal cal-in" key={date.getTime()}>
            <div className="cal-head">
                <button type="button" className="btn cal-back" onClick={onBack}>‹ Mes</button>
                <h4 ref={heading} tabIndex={-1}>{cap(date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))}</h4>
                <button type="button" className="cal-nav" onClick={() => onShift(-1)} aria-label="Día anterior">‹</button>
                <button type="button" className="cal-nav" onClick={() => onShift(1)} aria-label="Día siguiente">›</button>
            </div>

            {tasks.length ? (
                <ul className="list cal-tasks">
                    {tasks.map((t) => (
                        <li key={t.id} className={t.status === 'DONE' ? 'is-done' : ''}>
                            <ScoreChip task={t} />
                            <div className="grow">
                                <strong>{t.title}</strong>
                                {t.priorityReason && <small>{t.priorityReason}</small>}
                                <div className="cal-facts">
                                    <span><i className="dot" style={{ background: t.subject?.color ?? 'var(--line)' }} /> {t.subject?.name ?? 'Sin materia'}</span>
                                    <span>Entrega {new Date(t.dueDate).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}</span>
                                    <span>{t.weightPct}% de la nota</span>
                                    <span>{hours(Math.max(t.estimatedHours - t.hoursSpent, 0))} pendientes</span>
                                    <span className={`cal-status s-${t.status}`}>{STATUS[t.status]}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="muted cal-none">No hay entregas este día.</p>
            )}
        </section>
    );
}
