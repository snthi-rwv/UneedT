import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Err, FullscreenToggle, ThemeToggle } from '../components/ui';

export default function AuthPage() {
    const { login, register, error: sessionError } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [f, setF] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState(new URLSearchParams(window.location.search).get('oauth_error') ?? '');
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            if (mode === 'login') await login(f.email, f.password);
            else await register(f.name, f.email, f.password);
        } catch (er) {
            setError((er as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth">
            <div className="floating-tools">
                <ThemeToggle />
                <FullscreenToggle />
            </div>
            <section className="auth-pitch">
                <h1>Abre UneedT y ya sabes <mark>por dónde empezar</mark>.</h1>
                <p>Tus tareas llegan desde el correo institucional, la IA pesa cada una según la nota, la dificultad y la fecha, y te arma el plan del día.</p>
            </section>

            <form className="auth-card" onSubmit={submit}>
                <h2>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h2>
                {mode === 'register' && (
                    <label>Nombre<input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
                )}
                <label>Correo<input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
                <label>Contraseña<input required type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
                <Err msg={error || sessionError} />
                <button className="btn primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
                <a className="btn google" href="/api/oauth/google/login">Continuar con Google</a>
                <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
                    {mode === 'login' ? '¿Primera vez? Crea tu cuenta' : '¿Ya tienes cuenta? Entra'}
                </button>
            </form>
        </div>
    );
}