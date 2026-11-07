import { useState } from 'react';
import { api } from '../lib/api';
import { toInputDate } from '../lib/format';
import { Empty, Err, PageHead, useLoad } from '../components/ui';
import { EmailStatus, Proposal } from '../types';

// Correo: conexión OAuth (solo lectura) + panel de confirmación humana de lo que propone la IA
export default function Email() {
    const status = useLoad(() => api<EmailStatus>('/email/status'));
    const proposals = useLoad(() => api<Proposal[]>('/email/proposals'));
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState(new URLSearchParams(window.location.search).get('connected') ? 'Correo conectado. Estamos revisando tus mensajes recientes.' : '');
    const [actionError, setActionError] = useState('');

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key);
        setActionError('');
        try { await fn(); }
        catch (e) { setActionError((e as Error).message); }
        finally { setBusy(''); }
    };
    const refresh = () => Promise.all([status.reload(), proposals.reload()]);

    const connect = () => run('connect', async () => {
        const { url } = await api<{ url: string }>('/oauth/google/gmail/connect-url');
        window.location.href = url;
    });
    const syncNow = () => run('sync', async () => {
        const r = await api<{ fetched: number; proposed: number }>('/email/sync', { method: 'POST' });
        setMsg(`Se revisaron ${r.fetched} correo${r.fetched === 1 ? '' : 's'} y se encontraron ${r.proposed} posible${r.proposed === 1 ? '' : 's'} tarea${r.proposed === 1 ? '' : 's'}.`);
        await refresh();
    });
    const disconnect = () => {
        if (!confirm('Se retirará el permiso de lectura en Google y se borrarán las propuestas y los datos de correo guardados. Tus tareas ya aceptadas se conservan. ¿Continuar?')) return;
        run('disconnect', async () => {
            await api('/email/account', { method: 'DELETE' });
            setMsg('Correo desconectado y datos del correo eliminados.');
            await refresh();
        });
    };

    const s = status.data;
    const connected = s?.connected;

    return (
        <>
            <PageHead title="Correo" />
            <Err msg={status.error || proposals.error || actionError} />
            {msg && <p className="note" role="status">{msg}</p>}

            {s && !s.aiEnabled && (
                <p className="err">La IA no está configurada en el servidor: el correo no se puede analizar por ahora.</p>
            )}

            {s && !connected && (
                <section className="panel">
                    <h3>{s.account?.status === 'REVOKED' ? 'Google retiró el permiso: vuelve a conectar tu correo' : 'Conecta tu correo institucional'}</h3>
                    <p>UneedT lee tus correos recientes para encontrar entregas, parciales y talleres, y te las propone como tareas. Nada se agrega sin tu aprobación.</p>
                    <ul>
                        <li>El permiso es de <strong>solo lectura</strong>: UneedT no puede enviar, borrar ni modificar correos.</li>
                        <li>Solo se guardan los datos necesarios de cada tarea; el remitente y el fragmento del correo se borran al aceptar o descartar la propuesta.</li>
                        <li>Puedes desconectar el correo cuando quieras: se revoca el permiso en Google y se eliminan los datos del correo.</li>
                    </ul>
                    <label className="inline">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                        Autorizo a UneedT a tratar los datos de mi correo con esta finalidad, conforme a la Ley 1581 de 2012.
                    </label>
                    <p><button className="btn primary" disabled={!consent || !!busy} onClick={connect}>{busy === 'connect' ? 'Abriendo Google…' : 'Conectar con Google'}</button></p>
                </section>
            )}

            {s && connected && s.account && (
                <section className="panel row wrap">
                    <div className="grow">
                        <strong>{s.account.email}</strong>
                        <small>
                            {s.account.lastSyncAt ? `Última revisión: ${new Date(s.account.lastSyncAt).toLocaleString('es-CO')}` : 'Aún no se ha revisado'}
                            {' · se revisa solo cada 30 minutos'}
                        </small>
                        {s.lastLog && !s.lastLog.ok && s.lastLog.error && <small className="err">La última revisión falló: {s.lastLog.error}</small>}
                    </div>
                    <button className="btn" disabled={!!busy || !s.aiEnabled} onClick={syncNow}>{busy === 'sync' ? 'Revisando…' : 'Revisar ahora'}</button>
                    <button className="link danger" disabled={!!busy} onClick={disconnect}>Desconectar</button>
                </section>
            )}

            <h3>Tareas propuestas por la IA</h3>
            {proposals.data && !proposals.data.length && (
                <Empty title="No hay propuestas pendientes">{connected ? 'Cuando llegue un correo con una entrega, aparecerá aquí para que lo confirmes.' : 'Conecta tu correo para recibir propuestas.'}</Empty>
            )}
            <ul className="stack">
                {proposals.data?.map((p) => (
                    <ProposalCard key={p.id} p={p} disabled={!!busy}
                        onAccept={(body) => run(p.id, async () => { await api(`/email/proposals/${p.id}/accept`, { body }); await refresh(); })}
                        onReject={() => run(p.id, async () => { await api(`/email/proposals/${p.id}/reject`, { method: 'POST' }); await refresh(); })}
                    />
                ))}
            </ul>
        </>
    );
}

// Una propuesta: el estudiante puede ajustar los datos antes de aceptarla
function ProposalCard({ p, disabled, onAccept, onReject }: {
    p: Proposal; disabled: boolean; onAccept: (body: object) => void; onReject: () => void;
}) {
    const [f, setF] = useState({
        title: p.title,
        subjectName: p.subjectHint ?? '',
        dueDate: toInputDate(p.dueDate),
        weightPct: p.weightPct?.toString() ?? '',
        complexity: p.complexity?.toString() ?? '',
        estimatedHours: p.estimatedHours?.toString() ?? '',
    });
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

    const accept = () => onAccept({
        title: f.title.trim() || undefined,
        subjectName: f.subjectName.trim() || undefined,
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
        weightPct: f.weightPct !== '' ? Number(f.weightPct) : undefined,
        complexity: f.complexity !== '' ? Number(f.complexity) : undefined,
        estimatedHours: f.estimatedHours !== '' ? Number(f.estimatedHours) : undefined,
    });

    return (
        <li>
            <small>De {p.fromAddress} · «{p.emailSubject}» · confianza {Math.round(p.confidence * 100)}%</small>
            {p.description && <p>{p.description}</p>}
            <div className="grid">
                <label className="span2">Título<input maxLength={160} value={f.title} onChange={set('title')} /></label>
                <label>Materia<input maxLength={80} value={f.subjectName} onChange={set('subjectName')} placeholder="Sin materia" /></label>
                <label>Fecha de entrega<input type="datetime-local" value={f.dueDate} onChange={set('dueDate')} /></label>
                <label>Peso en la nota (%)<input type="number" min={0} max={100} step="any" value={f.weightPct} onChange={set('weightPct')} placeholder="10" /></label>
                <label>Complejidad (1-5)<input type="number" min={1} max={5} step={1} value={f.complexity} onChange={set('complexity')} placeholder="3" /></label>
                <label>Horas estimadas<input type="number" min={0.25} max={100} step={0.25} value={f.estimatedHours} onChange={set('estimatedHours')} placeholder="2" /></label>
            </div>
            {!p.dueDate && !f.dueDate && <small>Sin fecha: si no la indicas, se pondrá dentro de una semana.</small>}
            <div className="row">
                <button className="btn primary" disabled={disabled} onClick={accept}>Aceptar tarea</button>
                <button className="btn" disabled={disabled} onClick={onReject}>Descartar</button>
            </div>
        </li>
    );
}
