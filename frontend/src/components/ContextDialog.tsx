import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Guide, GuideResult, Task } from '../types';
import { DueText, Err } from './ui';

const LEVELS = ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'];
const ACCEPT = ['.pdf', '.docx', '.txt', '.md'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Ventana para darle contexto a UNA tarea.
 *  - mode "start": se abre con el botón Empezar. Tiene "Omitir": igual se arma un plan con lo que se sabe de la tarea.
 *  - mode "context": se abre desde Plan de estudio con "Añadir contexto" o "Actualizar contexto".
 * Al terminar llama onDone con el plan creado (o null si solo se marcó la tarea como en curso).
 */
export default function ContextDialog({ task, guide, mode, onClose, onDone }: {
    task: Pick<Task, 'id' | 'title' | 'complexity' | 'dueDate' | 'subject'>;
    guide?: Pick<Guide, 'context' | 'sourceName'> | null;
    mode: 'start' | 'context';
    onClose: () => void;
    onDone: (r: GuideResult | null) => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [difficulty, setDifficulty] = useState(task.complexity || 3);
    const [context, setContext] = useState(guide?.context ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [keptFile, setKeptFile] = useState(guide?.sourceName ?? null); // archivo que ya tenía el plan
    const [busy, setBusy] = useState<'' | 'send' | 'skip'>('');
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);

    useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []); // en desarrollo React lo ejecuta dos veces
    const close = () => { if (!busy) onClose(); };

    const pick = (f: File | undefined | null) => {
        setError('');
        if (!f) return;
        const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
        if (!ACCEPT.includes(ext)) return setError('Adjunta un PDF, un Word (.docx) o un archivo de texto (.txt).');
        if (f.size > MAX_BYTES) return setError('El archivo pesa más de 5 MB.');
        setFile(f);
    };
    const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); };

    const send = async (e?: FormEvent) => {
        e?.preventDefault();
        setBusy('send');
        setError('');
        const form = new FormData();
        form.append('difficulty', String(difficulty));
        form.append('context', context.trim());
        if (mode === 'start') form.append('start', '1');
        if (file) form.append('file', file);
        else if (guide?.sourceName && !keptFile) form.append('removeFile', '1');
        try {
            onDone(await api<GuideResult>(`/guides/${task.id}`, { body: form }));
        } catch (er) {
            setError((er as Error).message);
            setBusy('');
        }
    };

    // Omitir: la tarea queda en curso. Si aún no tiene plan, se arma uno con lo que ya se sabe de ella.
    const skip = async () => {
        setBusy('skip');
        setError('');
        try {
            if (guide !== undefined && guide !== null) {
                await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status: 'IN_PROGRESS', ...(difficulty !== task.complexity && { complexity: difficulty }) } });
                onDone(null);
            } else {
                const form = new FormData();
                form.append('difficulty', String(difficulty));
                form.append('start', '1');
                onDone(await api<GuideResult>(`/guides/${task.id}`, { body: form }));
            }
        } catch (er) {
            setError((er as Error).message);
            setBusy('');
        }
    };

    const shownFile = file?.name ?? keptFile;

    return (
        <dialog ref={ref} className="sheet" aria-labelledby="ctx-title" onCancel={(e) => { e.preventDefault(); close(); }}
            onClick={(e) => { if (e.target === ref.current) close(); }}>
            <form className="sheet-body" onSubmit={send}>
                <header className="sheet-head">
                    <div className="grow">
                        <p className="sheet-kicker">{mode === 'start' ? 'Vas a empezar' : guide ? 'Actualizar contexto' : 'Añadir contexto'}</p>
                        <h2 id="ctx-title">{task.title}</h2>
                        <p className="sheet-meta">
                            {task.subject && <span><i className="dot" style={{ background: task.subject.color }} /> {task.subject.name}</span>}
                            <DueText iso={task.dueDate} />
                        </p>
                    </div>
                    <button type="button" className="sheet-x" onClick={close} aria-label="Cerrar" disabled={!!busy}>×</button>
                </header>

                <fieldset className="field" disabled={!!busy}>
                    <legend>¿Qué tanto se te dificulta esta tarea?</legend>
                    <div className="seg seg-5" role="radiogroup">
                        {LEVELS.map((label, i) => (
                            <label key={label} className={difficulty === i + 1 ? 'on' : ''}>
                                <input type="radio" name="difficulty" value={i + 1} checked={difficulty === i + 1} onChange={() => setDifficulty(i + 1)} />
                                <b>{i + 1}</b><span>{label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="field">
                    <span>¿Qué tienes que hacer o estudiar? <em className="muted">(opcional)</em></span>
                    <textarea rows={4} maxLength={4000} value={context} onChange={(e) => setContext(e.target.value)} disabled={!!busy}
                        placeholder="Ej.: Temas del parcial: ecuaciones de Cauchy-Euler, homogéneas de primer orden y variación de parámetros." />
                </label>

                <div className="field">
                    <span>Rúbrica, enunciado o correo del profesor <em className="muted">(opcional)</em></span>
                    {shownFile ? (
                        <div className="file-chip">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                            <span className="grow">{shownFile}</span>
                            <button type="button" className="link danger" disabled={!!busy} onClick={() => { setFile(null); setKeptFile(null); }}>Quitar</button>
                        </div>
                    ) : (
                        <label className={`drop${dragging ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                            <input type="file" accept={ACCEPT.join(',')} disabled={!!busy} onChange={(e) => pick(e.target.files?.[0])} />
                            <strong>Elige un archivo</strong> o arrástralo aquí
                            <small>PDF, Word (.docx) o texto (.txt) · máximo 5 MB</small>
                        </label>
                    )}
                </div>

                <p className="sheet-privacy">El texto que escribas y el del documento se envían a la IA solo para armar tu paso a paso. El archivo no se guarda.</p>
                <Err msg={error} />

                <footer className="sheet-foot">
                    {mode === 'start'
                        ? <button type="button" className="btn" onClick={skip} disabled={!!busy}>{busy === 'skip' ? 'Un momento…' : 'Omitir'}</button>
                        : <button type="button" className="btn" onClick={close} disabled={!!busy}>Cancelar</button>}
                    <button className="btn primary" disabled={!!busy}>
                        {busy === 'send' ? 'La IA está armando tus pasos…' : mode === 'start' ? 'Continuar al plan' : guide ? 'Actualizar paso a paso' : 'Generar paso a paso'}
                    </button>
                </footer>
                {busy && <p className="sheet-wait" role="status">Esto puede tardar unos segundos.</p>}
            </form>
        </dialog>
    );
}
