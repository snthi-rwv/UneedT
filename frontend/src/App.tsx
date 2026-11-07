import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Email from './pages/Email';
import Plan from './pages/Plan';
import Progress from './pages/Progress';
import Subjects from './pages/Subjects';
import Tasks from './pages/Tasks';
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
                <Route path="/tareas" element={<Tasks />} />
                <Route path="/materias" element={<Subjects />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/correo" element={<Email />} />
                <Route path="/progreso" element={<Progress />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
}
