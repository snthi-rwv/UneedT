import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Err, PageHead, useLoad } from '../components/ui';
import { Focus } from '../types';

export default function Today() {
    const { user } = useAuth();
    const { data, error } = useLoad(() => api<Focus>('/tasks/focus'));

    return (
        <>
            <PageHead title={`Hola, ${user?.name}`} />
            <Err msg={error} />
            {data && <p>Tienes {data.openCount} tareas abiertas. La pantalla "Hoy" completa viene en el siguiente paso.</p>}
        </>
    );
}