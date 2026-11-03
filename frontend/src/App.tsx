import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Today from './pages/Today';

export default function App() {
    const { user, loading } = useAuth();
    if (loading) return <div className="boot">Cargando…</div>;

    // Sin sesión: solo login y registro
    if (!user) return <AuthPage />;

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Today />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
}