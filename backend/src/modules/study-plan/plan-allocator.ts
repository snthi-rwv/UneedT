// Reparte las horas disponibles entre tareas. Función pura (sin BD ni IA).
export interface AllocTask { id: string; priorityScore: number; pendingMinutes: number }

const round15 = (m: number) => Math.max(15, Math.round(m / 15) * 15);

/**
 * Cada tarea recibe tiempo proporcional a su puntaje² (premia a las más urgentes),
 * sin pasarse de lo que realmente le falta. El sobrante se reparte en nuevas rondas.
 * Devuelve minutos por tarea, en bloques de 15, sin exceder el tiempo disponible.
 * Se espera que `tasks` venga ordenada de mayor a menor prioridad.
 */
export function allocateMinutes(tasks: AllocTask[], availableMinutes: number): Map<string, number> {
    const raw = new Map<string, number>();
    let budget = availableMinutes;
    let pool = [...tasks];

    for (let round = 0; round < 4 && budget > 0 && pool.length; round++) {
        const total = pool.reduce((s, t) => s + t.priorityScore ** 2, 0) || 1;
        let used = 0;
        const stillHungry: AllocTask[] = [];
        for (const t of pool) {
            const have = raw.get(t.id) ?? 0;
            const give = Math.min((budget * t.priorityScore ** 2) / total, t.pendingMinutes - have);
            raw.set(t.id, have + give);
            used += give;
            if (have + give < t.pendingMinutes - 1) stillHungry.push(t);
        }
        budget -= used;
        pool = stillHungry;
    }

    // Redondeo a bloques de 15 min; se descarta lo muy pequeño
    const out = new Map<string, number>();
    for (const t of tasks) if ((raw.get(t.id) ?? 0) >= 10) out.set(t.id, round15(raw.get(t.id)!));

    // Si hay muy poco tiempo y nada alcanzó 10 min, todo va a la tarea más importante
    if (!out.size && tasks.length) out.set(tasks[0].id, round15(Math.min(availableMinutes, tasks[0].pendingMinutes)));

    // El redondeo puede pasarse: se recorta desde las menos prioritarias
    let over = [...out.values()].reduce((s, m) => s + m, 0) - availableMinutes;
    for (const t of [...tasks].reverse()) {
        if (over <= 0) break;
        const m = out.get(t.id);
        if (m && m > 15) {
            const cut = Math.min(Math.ceil(over / 15) * 15, m - 15);
            out.set(t.id, m - cut);
            over -= cut;
        }
    }
    return out;
}