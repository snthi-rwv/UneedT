// Cálculo de notas de una materia (escala 0.0 a 5.0, se aprueba con 3.0). Función pura: fácil de probar y de explicar.
// No se redondea: si la nota es 2.96, se muestra 2.96.

export const PASS_GRADE = 3;
export const MAX_GRADE = 5;

export interface GradeInput { percent: number; grade: number }

export type GradeStatus =
    | 'empty' // aún no hay notas
    | 'good' // necesita 3.0 o menos en lo que falta
    | 'ok' // necesita entre 3.0 y 4.0
    | 'hard' // necesita entre 4.0 y 5.0
    | 'impossible' // necesita más de 5.0: ya no alcanza la meta
    | 'secured' // ya tiene asegurada la meta, aunque saque 0 en lo que falta
    | 'finished'; // ya se evaluó el 100 %

export interface GradeSummary {
    evaluatedPct: number; // cuánto se ha evaluado (0 a 100)
    remainingPct: number; // cuánto falta por evaluar
    accumulated: number; // puntos ya ganados sobre la nota final (0 a 5)
    average: number | null; // promedio de lo evaluado (0 a 5)
    maxPossible: number; // nota final si saca 5.0 en todo lo que falta
    target: number; // nota que quiere sacar
    neededForTarget: number | null; // nota necesaria en lo que falta para la meta (null si ya no falta nada)
    neededToPass: number | null; // nota necesaria en lo que falta para aprobar con 3.0
    passed: boolean | null; // solo cuando se evaluó todo: si aprobó
    status: GradeStatus;
}

const needed = (goal: number, accumulated: number, remainingPct: number) =>
    remainingPct > 0 ? Math.max((goal - accumulated) / (remainingPct / 100), 0) : null;

/**
 * Promedio ponderado y cuánto necesita en lo que falta.
 *   acumulado = Σ (nota × porcentaje) / 100
 *   necesaria = (meta − acumulado) / (porcentaje que falta / 100)
 */
export function gradeSummary(entries: GradeInput[], target = PASS_GRADE): GradeSummary {
    // Se redondea la suma: 33.3 + 33.4 + 33.3 da 99.99999999999999 y dejaría un "por evaluar" que no existe
    const evaluatedPct = Math.min(Math.round(entries.reduce((n, e) => n + e.percent, 0) * 1e6) / 1e6, 100);
    const remainingPct = Math.max(100 - evaluatedPct, 0);
    const accumulated = entries.reduce((n, e) => n + (e.grade * e.percent) / 100, 0);
    const average = evaluatedPct > 0 ? (accumulated * 100) / evaluatedPct : null;
    const neededForTarget = needed(target, accumulated, remainingPct);
    const neededToPass = needed(PASS_GRADE, accumulated, remainingPct);

    let status: GradeStatus;
    if (!entries.length) status = 'empty';
    else if (remainingPct <= 0) status = 'finished';
    else if (accumulated >= target) status = 'secured';
    else if (neededForTarget! > MAX_GRADE) status = 'impossible';
    else if (neededForTarget! > 4) status = 'hard';
    else if (neededForTarget! > PASS_GRADE) status = 'ok';
    else status = 'good';

    return {
        evaluatedPct,
        remainingPct,
        accumulated,
        average,
        maxPossible: accumulated + (MAX_GRADE * remainingPct) / 100,
        target,
        neededForTarget,
        neededToPass,
        passed: remainingPct <= 0 ? accumulated >= PASS_GRADE : null,
        status,
    };
}

/**
 * Riesgo de perder la materia (0 a 1) para la prioridad de sus tareas.
 * Se basa en la nota que necesita en lo que falta para aprobar: 2.5 o menos = sin riesgo, 5.0 = riesgo máximo.
 * Si ya aprobó, o ya no hay nada que evaluar, el riesgo es 0. Si ya no alcanza, se deja en 0.5:
 * todavía conviene estudiar, pero subirle la prioridad al máximo no la salva.
 */
export function gradeRisk(s: GradeSummary): number | null {
    if (s.status === 'empty') return null; // sin notas: la prioridad usa la nota manual (si hay)
    if (s.remainingPct <= 0 || s.neededToPass === null || s.neededToPass <= 0) return 0;
    if (s.neededToPass > MAX_GRADE) return 0.5;
    return Math.min(Math.max((s.neededToPass - 2.5) / 2.5, 0), 1);
}
