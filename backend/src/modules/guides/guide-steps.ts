// Reglas de los pasos de un plan específico. Funciones puras (sin BD ni IA).

export interface StepDraft { title: string; detail: string; minutes: number }
export interface StepProgress { minutes: number; done: boolean; spentSeconds: number; creditedSeconds: number }

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);
const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Valida y limpia lo que devolvió la IA. Nunca se guarda nada sin pasar por aquí.
 * Devuelve null si no hay al menos 2 pasos utilizables (entonces se usa el plan B).
 */
export function cleanSteps(raw: unknown): StepDraft[] | null {
    if (!Array.isArray(raw)) return null;
    const steps = raw
        .filter((s) => s && typeof s === 'object')
        .map((s: any) => ({
            title: String(s.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
            detail: String(s.detail ?? '').replace(/\s+/g, ' ').trim().slice(0, 280),
            minutes: clamp(round5(Number(s.minutes) || 15), 5, 90),
        }))
        .filter((s) => s.title.length >= 3)
        .slice(0, 12);
    return steps.length >= 2 ? steps : null;
}

/** Plan B (sin IA): pasos generales que sirven para casi cualquier tarea, repartidos en el tiempo pendiente. */
export function fallbackSteps(pendingMinutes: number): StepDraft[] {
    const total = clamp(round5(pendingMinutes), 30, 600);
    const steps: StepDraft[] = [
        { title: 'Aclara qué te piden', detail: 'Relee el enunciado o la rúbrica y anota los entregables y cómo te van a evaluar.', minutes: 10 },
        { title: 'Reúne el material', detail: 'Junta apuntes, diapositivas y ejercicios de clase relacionados con el tema.', minutes: 10 },
    ];
    const closing: StepDraft = { title: 'Revisa y cierra', detail: 'Compara tu trabajo con lo que te piden, corrige y deja todo listo para entregar.', minutes: 10 };
    const core = Math.max(total - 30, 15);
    const parts = Math.ceil(core / 45);
    for (let i = 0; i < parts; i++) {
        const minutes = i < parts - 1 ? 45 : core - 45 * (parts - 1);
        steps.push({
            title: parts > 1 ? `Avanza en la parte principal (${i + 1} de ${parts})` : 'Avanza en la parte principal',
            detail: 'Empieza por lo más pesado o lo que más vale; anota tus dudas para resolverlas al final.',
            minutes: Math.max(round5(minutes), 5),
        });
    }
    return [...steps, closing];
}

/**
 * Ritmo real del estudiante: tiempo medido ÷ tiempo estimado en los pasos que ya terminó con cronómetro.
 * 1 = va según lo previsto; 1.5 = tarda 50% más. Con poca evidencia (menos de 20 min) se asume 1.
 */
export function paceFactor(steps: StepProgress[]) {
    const timed = steps.filter((s) => s.done && s.spentSeconds > 0);
    const planned = timed.reduce((n, s) => n + s.minutes * 60, 0);
    if (planned < 20 * 60) return 1;
    const real = timed.reduce((n, s) => n + s.creditedSeconds, 0);
    return clamp(real / planned, 0.75, 2.5);
}

/** Horas que faltan para terminar la tarea, ajustadas al ritmo real. */
export function remainingHours(steps: StepProgress[]) {
    const pending = steps.filter((s) => !s.done).reduce((n, s) => n + s.minutes, 0);
    return (pending * paceFactor(steps)) / 60;
}
