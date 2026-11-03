import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { tokens } from './lib/api';
import { AuthProvider } from './lib/auth';
import './styles.css';

// Si volvemos de "Continuar con Google", los tokens vienen en el # de la URL.
// Se guardan y la URL se limpia ANTES de montar React, así ningún otro código compite con este paso.
function takeGoogleTokens() {
    if (window.location.pathname !== '/auth/callback') return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const access = p.get('access');
    const refresh = p.get('refresh');
    if (access && refresh) {
        tokens.set(access, refresh); // reemplaza cualquier sesión vieja
        window.history.replaceState(null, '', '/'); // borra los tokens de la barra de direcciones
    } else {
        window.history.replaceState(null, '', '/?oauth_error=' + encodeURIComponent('No llegaron los datos de sesión desde Google.'));
    }
}
takeGoogleTokens();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/* Las dos "future flags" adoptan hoy el comportamiento de React Router v7 y silencian los avisos */}
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);