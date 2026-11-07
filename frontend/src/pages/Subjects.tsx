import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { Empty, Err, PageHead, useLoad } from '../components/ui';
import { Subject } from '../types';

const COLORS = ['#14213D', '#2B59C3', '#1F7A5C', '#B4412F', '#B7791F', '#7B3FA0'];
const DIFFICULTY = ['Muy fácil', 'Fácil', 'Media', 'Difícil', 'Muy difícil'];
const blank = { name: '', difficulty: '3', currentGrade: '', color: COLORS[0] };

// Materias: su dificultad y la nota actual alimentan el "riesgo" de la prioridad
export default function Subjects() {
    const { data, error, reload } = useLoad(() => api<Subject[]>('/subjects'));
    const [editing, setEditing] = useState<Subject | 'new' | null>(null);
    const [f, setF] = useState(blank);
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);

    const open = (s: Subject | 'new') => {
        setEditing(s);
        setFormError('');
        setF(s === 'new' ? blank : { name: s.name, difficulty: String(s.difficulty), currentGrade: s.currentGrade?.toString() ?? '', color: s.color });
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setFormError('');
        const isNew = editing === 'new';
        const body = {
            name: f.name.trim(),
            difficulty: Number(f.difficulty),
            color: f.color,
            ...(f.currentGrade !== '' ? { currentGrade: Number(f.currentGrade) } : isNew ? {} : { currentGrade: null }),
        };
        try {
            await api(isNew ? '/subjects' : `/subjects/${(editing as Subject).id}`, { method: isNew ? 'POST' : 'PATCH', body });
            setEditing(null);
            await reload();
        } catch (er) {
            setFormError((er as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (s: Subject) => {
        if (!confirm(`¿Eliminar "${s.name}"? Sus tareas quedarán sin materia.`)) return;
        try { await api(`/subjects/${s.id}`, { method: 'DELETE' }); await reload(); }
        catch (er) { setFormError((er as Error).message); }
    };

    return (
        <>
            <PageHead title="Materias">
                <button className="btn primary" onClick={() => open('new')}>Nueva materia</button>
            </PageHead>
            <p className="muted">La dificultad y tu nota actual ayudan a UneedT a saber qué materia necesita más refuerzo.</p>
            <Err msg={error} />

            {editing && (
                <form className="panel grid" onSubmit={submit}>
                    <h3>{editing === 'new' ? 'Nueva materia' : 'Editar materia'}</h3>
                    <label className="span2">Nombre<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                    <label>Dificultad
                        <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
                            {DIFFICULTY.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
                        </select>
                    </label>
                    <label>Nota actual (0.0 – 5.0, opcional)
                        <input type="number" min={0} max={5} step={0.1} value={f.currentGrade} onChange={(e) => setF({ ...f, currentGrade: e.target.value })} />
                    </label>
                    <div className="span2">
                        <span className="muted">Color</span>
                        <div className="swatches" role="radiogroup" aria-label="Color">
                            {COLORS.map((c) => (
                                <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c}
                                    className={f.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setF({ ...f, color: c })} />
                            ))}
                        </div>
                    </div>
                    <div className="span2"><Err msg={formError} /></div>
                    <div className="row span2">
                        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
                        <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
                    </div>
                </form>
            )}
            {!editing && <Err msg={formError} />}

            {data && !data.length && (
                <Empty title="Aún no tienes materias">Agrega las materias del semestre; también se crean solas al aceptar tareas del correo.</Empty>
            )}

            <ul className="list">
                {data?.map((s) => (
                    <li key={s.id}>
                        <i className="dot lg" style={{ background: s.color }} />
                        <div className="grow">
                            <strong>{s.name}</strong>
                            <small>
                                Dificultad: {DIFFICULTY[s.difficulty - 1]} · Nota: {s.currentGrade != null ? s.currentGrade.toFixed(1) : 'sin registrar'}
                                {' · '}{s._count?.tasks ?? 0} tarea{s._count?.tasks === 1 ? '' : 's'} abierta{s._count?.tasks === 1 ? '' : 's'}
                            </small>
                        </div>
                        <div className="row">
                            <button className="link" onClick={() => open(s)}>Editar</button>
                            <button className="link danger" onClick={() => remove(s)}>Eliminar</button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}
