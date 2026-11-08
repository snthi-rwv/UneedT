import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { StudyDayPoint, Survey } from '../types';

// Series del bienestar (escala 1-5). El color es solo una pista: cada una tiene además su forma de marcador y su etiqueta.
const SERIES = [
    { key: 'score', name: 'Agobio', color: 'var(--s-stress)', shape: 'circle', scale: ['Nada', 'Poco', 'Algo', 'Bastante', 'Muchísimo'] },
    { key: 'concentration', name: 'Concentración', color: 'var(--s-focus)', shape: 'square', scale: ['Muy baja', 'Baja', 'Normal', 'Buena', 'Excelente'] },
    { key: 'performance', name: 'Rendimiento', color: 'var(--s-perf)', shape: 'diamond', scale: ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'] },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];
export const CHECKIN_QUESTIONS = SERIES;

const GOAL_MIN = 15; // un día cuenta para la racha con 15 minutos
const localDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // AAAA-MM-DD en la hora del navegador
const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const longDate = (d: string) => { const t = new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

// Ancho real del contenedor, para dibujar el SVG sin deformar el texto
function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [w, setW] = useState(0);
    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);
    return [ref, w] as const;
}

function Marker({ shape, x, y, color }: { shape: string; x: number; y: number; color: string }) {
    const common = { fill: color, stroke: 'var(--card)', strokeWidth: 2 };
    if (shape === 'square') return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1.5} {...common} />;
    if (shape === 'diamond') return <path d={`M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`} {...common} />;
    return <circle cx={x} cy={y} r={4.5} {...common} />;
}

/**
 * Tablero de Progreso: cómo te has sentido (agobio, concentración y rendimiento, de 1 a 5) y cuánto estudiaste cada día.
 * Son dos gráficos con el mismo eje de fechas (nunca un gráfico con dos escalas), y una sola línea de lectura al pasar el cursor.
 */
export default function ProgressCharts({ surveys, days }: { surveys: Survey[]; days: StudyDayPoint[] }) {
    const [wrapRef, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);

    const dates = days.map((d) => d.date);
    const byDate = new Map(surveys.map((s) => [localDate(s.createdAt), s]));
    const n = dates.length;

    // Geometría compartida por los dos gráficos
    const padL = 34, gutter = width < 520 ? 12 : 112, padR = gutter;
    const plotW = Math.max(width - padL - padR, 10);
    const x = (i: number) => padL + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
    const slot = n > 1 ? plotW / (n - 1) : plotW;

    // Gráfico 1: bienestar
    const H1 = 210, top1 = 14, bottom1 = 24;
    const y1 = (v: number) => top1 + ((5 - v) * (H1 - top1 - bottom1)) / 4;
    const points = (k: SeriesKey) => dates.flatMap((d, i) => {
        const v = byDate.get(d)?.[k];
        return v != null ? [{ i, v }] : [];
    });

    // Etiquetas al final de cada línea, sin chocar entre sí
    const ends = SERIES.map((s) => { const p = points(s.key); return { s, last: p[p.length - 1] }; }).filter((e) => e.last);
    const placed = [...ends].sort((a, b) => y1(a.last!.v) - y1(b.last!.v));
    let prevY = -Infinity;
    const labelY = new Map<string, number>();
    for (const e of placed) {
        const yy = Math.max(y1(e.last!.v), prevY + 15);
        labelY.set(e.s.key, yy);
        prevY = yy;
    }

    // Gráfico 2: minutos por día
    const H2 = 150, top2 = 12, bottom2 = 26;
    const maxMin = Math.max(60, ...days.map((d) => d.minutes));
    const niceMax = Math.ceil(maxMin / 30) * 30;
    const y2 = (m: number) => top2 + ((niceMax - m) * (H2 - top2 - bottom2)) / niceMax;
    const barW = Math.max(Math.min(24, slot - 2), 2);
    const tickEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(plotW / 70), 2)));

    const pick = (e: PointerEvent<SVGElement>) => {
        const box = (e.currentTarget as SVGElement).getBoundingClientRect();
        const px = e.clientX - box.left;
        setHover(Math.min(Math.max(Math.round((px - padL) / (slot || 1)), 0), n - 1));
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min((h ?? n - 2) + 1, n - 1)); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max((h ?? n) - 1, 0)); }
        if (e.key === 'Escape') setHover(null);
    };

    const hd = hover != null ? dates[hover] : null;
    const hs = hd ? byDate.get(hd) : undefined;
    const tipLeft = hover != null ? Math.min(Math.max(x(hover) - 115, 0), Math.max(width - 230, 0)) : 0;

    const anySurvey = dates.some((d) => byDate.has(d));

    return (
        <div className="pcharts" ref={wrapRef} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)}
            aria-label="Gráficos de progreso. Usa las flechas izquierda y derecha para recorrer los días.">
            {width > 0 && (
                <>
                    <div className="pchart-head">
                        <h4>Cómo te has sentido</h4>
                        <div className="legend" aria-hidden="true">
                            {SERIES.map((s) => (
                                <span key={s.key}><svg width="22" height="12"><line x1="1" y1="6" x2="21" y2="6" stroke={s.color} strokeWidth="2" /><Marker shape={s.shape} x={11} y={6} color={s.color} /></svg>{s.name}</span>
                            ))}
                        </div>
                    </div>
                    <svg width={width} height={H1} className="pchart" onPointerMove={pick} onPointerLeave={() => setHover(null)} role="img"
                        aria-label="Agobio, concentración y rendimiento por día, de 1 a 5">
                        {[1, 2, 3, 4, 5].map((v) => (
                            <g key={v}>
                                <line x1={padL} x2={padL + plotW} y1={y1(v)} y2={y1(v)} className="grid" />
                                <text x={padL - 10} y={y1(v) + 4} className="tick" textAnchor="end">{v}</text>
                            </g>
                        ))}
                        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={top1} y2={H1 - bottom1} className="cross" />}
                        {SERIES.map((s) => {
                            const pts = points(s.key);
                            if (!pts.length) return null;
                            return (
                                <g key={s.key}>
                                    <path d={pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)} ${y1(p.v)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                    {pts.map((p) => <Marker key={p.i} shape={s.shape} x={x(p.i)} y={y1(p.v)} color={s.color} />)}
                                </g>
                            );
                        })}
                        {gutter > 40 && ends.map(({ s, last }) => (
                            <g key={s.key}>
                                <line x1={x(last!.i) + 7} x2={padL + plotW + 8} y1={y1(last!.v)} y2={labelY.get(s.key)!} className="leader" />
                                <text x={padL + plotW + 12} y={labelY.get(s.key)! + 4} className="endlabel">{s.name} {last!.v}</text>
                            </g>
                        ))}
                        {!anySurvey && <text x={padL + plotW / 2} y={H1 / 2} textAnchor="middle" className="empty-msg">Responde la encuesta de hoy para empezar tu historial.</text>}
                    </svg>

                    <div className="pchart-head">
                        <h4>Minutos de estudio por día</h4>
                        <span className="muted small">Los días con {GOAL_MIN} min o más cuentan para tu racha</span>
                    </div>
                    <svg width={width} height={H2} className="pchart" onPointerMove={pick} onPointerLeave={() => setHover(null)} role="img"
                        aria-label="Minutos de estudio por día">
                        {[0, niceMax / 2, niceMax].map((v) => (
                            <g key={v}>
                                <line x1={padL} x2={padL + plotW} y1={y2(v)} y2={y2(v)} className="grid" />
                                <text x={padL - 10} y={y2(v) + 4} className="tick" textAnchor="end">{v}</text>
                            </g>
                        ))}
                        <line x1={padL} x2={padL + plotW} y1={y2(GOAL_MIN)} y2={y2(GOAL_MIN)} className="goal" />
                        {gutter > 40 && <text x={padL + plotW + 12} y={y2(GOAL_MIN) + 4} className="endlabel muted-label">Meta {GOAL_MIN} min</text>}
                        {days.map((d, i) => {
                            if (!d.minutes) return null;
                            const yTop = y2(d.minutes), h = H2 - bottom2 - yTop, r = Math.min(4, h, barW / 2), bx = x(i) - barW / 2;
                            return (
                                <path key={d.date} className={`bar${d.minutes >= GOAL_MIN ? '' : ' below'}${hover === i ? ' on' : ''}`}
                                    d={`M${bx} ${H2 - bottom2}V${yTop + r}Q${bx} ${yTop} ${bx + r} ${yTop}H${bx + barW - r}Q${bx + barW} ${yTop} ${bx + barW} ${yTop + r}V${H2 - bottom2}Z`} />
                            );
                        })}
                        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={top2} y2={H2 - bottom2} className="cross" />}
                        {dates.map((d, i) => (i % tickEvery === 0 || i === n - 1) && (n - 1 - i >= tickEvery || i === n - 1) ? (
                            <text key={d} x={x(i)} y={H2 - 6} textAnchor="middle" className="tick">{shortDate(d)}</text>
                        ) : null)}
                    </svg>

                    {hd && (
                        <div className="ptip" style={{ left: tipLeft }} role="status">
                            <p className="ptip-date">{longDate(hd)}</p>
                            {SERIES.map((s) => {
                                const v = hs?.[s.key];
                                return (
                                    <p key={s.key}><svg width="14" height="8" aria-hidden="true"><line x1="0" y1="4" x2="14" y2="4" stroke={s.color} strokeWidth="2" /></svg>
                                        <b>{v != null ? `${v} · ${s.scale[v - 1]}` : '—'}</b> <span>{s.name}</span></p>
                                );
                            })}
                            <p><svg width="14" height="8" aria-hidden="true"><rect x="2" y="0" width="10" height="8" rx="2" fill="var(--s-min)" /></svg>
                                <b>{fmtMin(days[hover!].minutes)}</b> <span>de estudio</span></p>
                        </div>
                    )}
                </>
            )}

            <details className="ptable">
                <summary>Ver los datos en tabla</summary>
                <div className="ptable-scroll">
                    <table>
                        <thead><tr><th>Día</th><th>Agobio</th><th>Concentración</th><th>Rendimiento</th><th>Estudio</th></tr></thead>
                        <tbody>
                            {[...dates].reverse().filter((d) => byDate.has(d) || days.find((x) => x.date === d)!.minutes).map((d) => {
                                const sv = byDate.get(d);
                                return (
                                    <tr key={d}>
                                        <td>{shortDate(d)}</td>
                                        <td>{sv?.score ?? '—'}</td><td>{sv?.concentration ?? '—'}</td><td>{sv?.performance ?? '—'}</td>
                                        <td>{fmtMin(days.find((x) => x.date === d)!.minutes)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
}
