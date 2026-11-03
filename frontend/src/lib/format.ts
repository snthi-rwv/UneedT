// Texto y color para una fecha de entrega: "Vence mañana", "Venció el 3 nov"...
export const fmtDue = (iso: string) => {
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    const date = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    if (days < 0) return { text: `Venció el ${date}`, tone: 'late' as const };
    if (days === 0) return { text: 'Vence hoy', tone: 'late' as const };
    if (days === 1) return { text: 'Vence mañana', tone: 'soon' as const };
    return { text: `${date} · en ${days} días`, tone: days <= 3 ? ('soon' as const) : ('ok' as const) };
};

// Fecha ISO → valor para <input type="datetime-local"> (en hora local)
export const toInputDate = (iso?: string | null) =>
    iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export const hours = (h: number) => (h % 1 === 0 ? `${h} h` : `${h.toFixed(1)} h`);
export const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);