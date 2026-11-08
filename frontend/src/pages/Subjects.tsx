import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import SubjectGrades from '../components/SubjectGrades';
import { Empty, Err, PageHead, useLoad } from '../components/ui';
import { Subject } from '../types';

const STATUS_LABEL = { good: 'Vas bien', ok: 'Aún puedes', hard: 'Complicado', impossible: 'En riesgo', secured: 'Asegurada', finished: 'Terminada' } as const;
const floor2 = (n: number) => (Math.floor(n * 100 + 1e-9) / 100).toFixed(2);

const COLORS = ['#14213D', '#2B59C3', '#1F7A5C', '#B4412F', '#B7791F', '#7B3FA0'];
const DIFFICULTY = ['Muy fácil', 'Fácil', 'Media', 'Difícil', 'Muy difícil'];
const blank = { name: '', difficulty: '3', currentGrade: '', color: COLORS[0] };

// Materias: su dificultad y sus notas alimentan el "riesgo" de la prioridad. Cada una se despliega para registrar notas.
export default function Subjects() {
    const { data, error, reload } = useLoad(() => api<Subject[]>('/subjects'));
    const [openId, setOpenId] = useState<string | null>(null);
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
            <p className="muted">Abre una materia para registrar tus notas: UneedT calcula cuánto necesitas en lo que falta y prioriza las materias en riesgo.</p>
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
                    {editing !== 'new' && editing.gradesCount ? (
                        <p className="muted small">La nota actual se calcula con las notas que registraste en la materia.</p>
                    ) : (
                        <label>Nota actual (0.0 – 5.0, opcional)
                            <input type="number" min={0} max={5} step={0.1} value={f.currentGrade} onChange={(e) => setF({ ...f, currentGrade: e.target.value })} />
                        </label>
                    )}
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

            <ul className="list subjects">
                {data?.map((s) => {
                    const sum = s.summary;
                    const isOpen = openId === s.id;
                    return (
                        <li key={s.id} className={isOpen ? 'open' : ''}>
                            <button type="button" className="subj-head" onClick={() => setOpenId(isOpen ? null : s.id)} aria-expanded={isOpen}>
                                <i className="dot lg" style={{ background: s.color }} />
                                <span className="grow">
                                    <strong>{s.name}</strong>
                                    <small>
                                        {sum && sum.status !== 'empty'
                                            ? <>Promedio {sum.average != null ? floor2(sum.average) : '—'} · {Math.round(sum.evaluatedPct * 100) / 100} % evaluado</>
                                            : <>Nota: {s.currentGrade != null ? s.currentGrade.toFixed(1) : 'sin registrar'}</>}
                                        {' · '}Dificultad: {DIFFICULTY[s.difficulty - 1]}
                                        {' · '}{s._count?.tasks ?? 0} tarea{s._count?.tasks === 1 ? '' : 's'} abierta{s._count?.tasks === 1 ? '' : 's'}
                                    </small>
                                </span>
                                {sum && sum.status !== 'empty' && (
                                    // Si lo que no alcanza es solo la meta (pero aprobar sí), no se asusta al estudiante con "En riesgo"
                                    sum.status === 'impossible' && sum.neededToPass != null && sum.neededToPass <= 5
                                        ? <em className="gstatus target">Meta alta</em>
                                        : <em className={`gstatus ${sum.status}`}>{STATUS_LABEL[sum.status]}</em>
                                )}
                                <span className="subj-cta">{isOpen ? 'Cerrar' : 'Notas'}</span>
                                <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                            </button>
                            {isOpen && (
                                <div className="subj-body">
                                    <SubjectGrades subjectId={s.id} onSaved={reload} />
                                    <div className="row subj-actions">
                                        <button className="link" onClick={() => open(s)}>Editar materia</button>
                                        <button className="link danger" onClick={() => remove(s)}>Eliminar</button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
