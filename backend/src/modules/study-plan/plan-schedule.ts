// Horarios del plan de estudio. Funciones puras (sin BD ni IA): fáciles de probar y de explicar.
import { PlanIntensity } from '@prisma/client';

// Intensidad = duración máxima de cada bloque y descanso entre bloques (minutos)
export const INTENSITY: Record<PlanIntensity, { block: number; rest: number }> = {
    LIGHT: { block: 25, rest: 5 },
    NORMAL: { block: 45, rest: 10 },
    INTENSE: { block: 60, rest: 10 },
};

export const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
export const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Minuto del día en Colombia (0 a 1439). */
export function bogotaNowMinutes(now = new Date()) {
    const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    return toMin(t);
}

/**
 * Parte el tiempo de una tarea en bloques que no pasan del tamaño de la intensidad.
 * Si sobra un pedazo de menos de 10 min, se reparte con el bloque anterior (ej.: 25 + 5 → 15 + 15).
 */
export function splitMinutes(total: number, block: number): number[] {
    const parts: number[] = [];
    for (let left = total; left > 0; left -= block) parts.push(Math.min(block, left));
    if (parts.length > 1 && parts[parts.length - 1] < 10) {
        const pair = parts.pop()! + parts.pop()!;
        const first = Math.ceil(pair / 2 / 5) * 5;
        parts.push(first, pair - first);
    }
    return parts;
}

export interface Slot { taskId: string; minutes: number; startTime: string }

/**
 * Pone los bloques uno tras otro, con su descanso entre cada uno.
 * Las tareas van en el orden recibido (de mayor a menor prioridad).
 * Devuelve los bloques y el minuto del día en que termina el último.
 */
export function schedule(items: { taskId: string; minutes: number }[], startMin: number, intensity: PlanIntensity) {
    const { block, rest } = INTENSITY[intensity];
    const slots: Slot[] = [];
    let cursor = startMin;
    for (const it of items) {
        for (const part of splitMinutes(it.minutes, block)) {
            slots.push({ taskId: it.taskId, minutes: part, startTime: hhmm(cursor) });
            cursor += part + rest;
        }
    }
    return { slots, endMin: slots.length ? cursor - rest : startMin };
}

/** Minutos de estudio que caben en una ventana de tiempo, descontando los descansos (aproximado). */
export function studyMinutesInWindow(windowMin: number, intensity: PlanIntensity) {
    const { block, rest } = INTENSITY[intensity];
    return Math.max(0, Math.floor((windowMin * block) / (block + rest)));
}
