import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { GradeSummary, SubjectGrades as Data } from '../types';
import { Err } from './ui';

const PASS = 3;
// Nunca se le muestra al estudiante una nota mejor de la que tiene: lo logrado se corta, lo que necesita se sube
const down = (n: number) => (Math.floor(n * 100 + 1e-9) / 100).toFixed(2);
const up = (n: number) => (Math.ceil(n * 100 - 1e-9) / 100).toFixed(2);
const pct = (n: number) => `${Math.round(n * 100) / 100} %`;

interface Row { key: number; label: string; percent: string; grade: string }
let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, label: '', percent: '', grade: '' });

/** Mensaje principal según cómo va la materia (al estilo de "¿cuánto necesito para el final?"). */
function verdict(s: GradeSummary) {
    const need = s.neededForTarget != null ? up(s.neededForTarget) : '';
    const goal = s.target.toFixed(1);
    const rest = pct(s.remainingPct);
    const passLine = s.target > PASS && s.neededToPass != null && s.neededToPass > 0 && s.neededToPass <= 5
        ? `Para aprobar con 3.0 necesitas ${up(s.neededToPass)}.` : '';
    switch (s.status) {
        case 'good': return { tone: 'good', title: 'Vas muy bien', text: `Necesitas ${need} en el ${rest} que falta para llegar a ${goal}. No te confíes.`, extra: passLine };
        case 'ok': return { tone: 'ok', title: 'Aún puedes', text: `Necesitas ${need} en el ${rest} que falta para llegar a ${goal}. Dale con todo.`, extra: passLine };
        case 'hard': return { tone: 'hard', title: 'Está complicado', text: `Necesitas ${need} en el ${rest} que falta para llegar a ${goal}. Esta materia necesita prioridad.`, extra: passLine };
        case 'impossible': return {
            tone: 'bad', title: `Ya no alcanzas ${goal}`,
            text: `Aunque saques 5.0 en el ${rest} que falta, llegarías a ${down(s.maxPossible)}.`,
            extra: s.target > PASS && s.neededToPass != null && s.neededToPass <= 5
                ? `Para aprobar con 3.0 todavía puedes: necesitas ${up(s.neededToPass)}.`
                : 'Habla con tu profesor sobre opciones de recuperación o habilitación.',
        };
        case 'secured': return { tone: 'good', title: '¡Ya lo tienes!', text: `Ya aseguraste ${goal} aunque saques 0.0 en el ${rest} que falta.`, extra: '' };
        case 'finished': return s.passed
            ? { tone: 'good', title: 'Aprobaste', text: `Tu nota final es ${down(s.accumulated)}.`, extra: '' }
            : { tone: 'bad', title: 'No alcanzó', text: `Tu nota final es ${down(s.accumulated)}. Se aprueba con 3.0.`, extra: '' };
        default: return null;
    }
}

/**
 * Notas de una materia: el estudiante escribe qué porcentaje se evaluó y qué nota sacó.
 * "Validar" guarda, calcula el promedio ponderado y le dice cuánto necesita en lo que falta.
 */
export default function SubjectGrades({ subjectId, onSaved }: { subjectId: string; onSaved: () => void }) {
    const [saved, setSaved] = useState<Data | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [target, setTarget] = useState('3.0');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);

    const load = (d: Data) => {
        setSaved(d);
        setRows(d.entries.length ? d.entries.map((e) => ({ key: nextKey++, label: e.label, percent: String(e.percent), grade: String(e.grade) })) : [blankRow(), blankRow()]);
        setTarget(d.targetGrade.toFixed(1));
        setDirty(false);
    };
    useEffect(() => {
        api<Data>(`/subjects/${subjectId}/grades`).then(load).catch((e) => setError(e.message));
    }, [subjectId]);

    const edit = (key: number, field: keyof Row, value: string) => { setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r))); setDirty(true); };
    const remove = (key: number) => { setRows((rs) => rs.filter((r) => r.key !== key)); setDirty(true); };

    const filled = rows.filter((r) => r.percent !== '' || r.grade !== '' || r.label.trim());
    const totalPct = filled.reduce((n, r) => n + (Number(r.percent) || 0), 0);

    const validate = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        // Revisión antes de enviar, con mensajes claros
        for (const [i, r] of filled.entries()) {
            const p = Number(r.percent), g = Number(r.grade);
            if (r.percent === '' || !(p > 0 && p <= 100)) return setError(`Fila ${i + 1}: el porcentaje debe ser mayor que 0 y máximo 100.`);
            if (r.grade === '' || !(g >= 0 && g <= 5)) return setError(`Fila ${i + 1}: la nota va de 0.0 a 5.0.`);
        }
        if (totalPct > 100.0001) return setError(`Los porcentajes suman ${pct(totalPct)}. No pueden pasar de 100 %.`);
        const t = Number(target);
        if (!(t >= 3 && t <= 5)) return setError('La nota que quieres sacar debe estar entre 3.0 y 5.0.');

        setBusy(true);
        try {
            load(await api<Data>(`/subjects/${subjectId}/grades`, {
                method: 'PUT',
                body: { targetGrade: t, entries: filled.map((r) => ({ label: r.label.trim(), percent: Number(r.percent), grade: Number(r.grade) })) },
            }));
            onSaved();
        } catch (er) {
            setError((er as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (!saved) return <div className="grades"><Err msg={error} />{!error && <p className="muted">Cargando notas…</p>}</div>;
    const s = saved.summary;
    const v = verdict(s);

    return (
        <form className="grades" onSubmit={validate}>
            {s.status !== 'empty' && (
                <div className="grade-stats">
                    <div><b>{pct(s.evaluatedPct)}</b><span>evaluado</span></div>
                    <div><b>{down(s.accumulated)}</b><span>acumulado de 5.0</span></div>
                    <div><b>{s.average != null ? down(s.average) : '—'}</b><span>promedio de lo evaluado</span></div>
                    <div><b>{pct(s.remainingPct)}</b><span>por evaluar</span></div>
                </div>
            )}
            {v && !dirty && (
                <div className={`verdict ${v.tone}`} role="status">
                    <strong>{v.title}</strong>
                    <p>{v.text}</p>
                    {v.extra && <p>{v.extra}</p>}
                </div>
            )}

            <div className="grade-table" role="table" aria-label="Notas de la materia">
                <div className="grade-row head" role="row">
                    <span role="columnheader">Evaluación (opcional)</span><span role="columnheader">Porcentaje</span><span role="columnheader">Nota</span><span aria-hidden="true" />
                </div>
                {rows.map((r, i) => (
                    <div className="grade-row" role="row" key={r.key}>
                        <input aria-label={`Nombre de la evaluación ${i + 1}`} placeholder={`Ej.: Parcial ${i + 1}`} maxLength={60} value={r.label} onChange={(e) => edit(r.key, 'label', e.target.value)} />
                        <span className="suffix"><input aria-label={`Porcentaje de la evaluación ${i + 1}`} type="number" inputMode="decimal" min={0} max={100} step="any" placeholder="30" value={r.percent} onChange={(e) => edit(r.key, 'percent', e.target.value)} /><em>%</em></span>
                        <input aria-label={`Nota de la evaluación ${i + 1}`} type="number" inputMode="decimal" min={0} max={5} step="any" placeholder="3.5" value={r.grade} onChange={(e) => edit(r.key, 'grade', e.target.value)} />
                        <button type="button" className="row-x" onClick={() => remove(r.key)} aria-label={`Quitar la evaluación ${i + 1}`}>×</button>
                    </div>
                ))}
            </div>

            <div className="grade-foot">
                <button type="button" className="btn tiny" onClick={() => { setRows((rs) => [...rs, blankRow()]); setDirty(true); }} disabled={rows.length >= 30}>+ Agregar nota</button>
                <span className={`small ${totalPct > 100.0001 ? 'over' : 'muted'}`}>Suman {pct(totalPct)} de 100 %</span>
                <label className="inline target">Quiero sacar
                    <input type="number" min={3} max={5} step={0.1} value={target} onChange={(e) => { setTarget(e.target.value); setDirty(true); }} aria-label="Nota final que quieres sacar" />
                </label>
            </div>

            <Err msg={error} />
            <div className="row">
                <button className="btn primary" disabled={busy}>{busy ? 'Calculando…' : 'Validar'}</button>
                {dirty && <span className="muted small">Tienes cambios sin validar.</span>}
            </div>
        </form>
    );
}
