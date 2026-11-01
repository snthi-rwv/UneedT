// Cálculo puro (sin base de datos ni IA): fácil de probar y de explicar.
export const CRITICAL_THRESHOLD = 65; // desde aquí una tarea se considera crítica
const DAY = 86_400_000;
const PRODUCTIVE_HOURS_PER_DAY = 3;
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

export interface TaskInput { dueDate: Date; weightPct: number; complexity: number; estimatedHours: number; hoursSpent: number }
export interface SubjectInput { difficulty: number; currentGrade: number | null }

/**
 * Puntaje base 0-100:
 *  35% urgencia · 35% peso en la nota · 15% complejidad · 15% riesgo de la materia
 */
export function scoreTask(t: TaskInput, s: SubjectInput | null, now = new Date()) {
    const pendingHours = Math.max(t.estimatedHours - t.hoursSpent, 0.25);
    const daysLeft = (t.dueDate.getTime() - now.getTime()) / DAY;
    const slack = daysLeft - pendingHours / PRODUCTIVE_HOURS_PER_DAY; // holgura = días que sobran
    const urgency = slack <= 0 ? 1 : 1 / (1 + slack / 3);
    const weight = clamp(t.weightPct / 30, 0, 1); // 30% de la nota o más = máximo
    const complexity = (t.complexity - 1) / 4;
    const gradeRisk = s?.currentGrade != null ? clamp((3.5 - s.currentGrade) / 3.5, 0, 1) : 0.3;
    const risk = s ? 0.6 * ((s.difficulty - 1) / 4) + 0.4 * gradeRisk : 0.3;

    // Los dos factores que más pesaron explican el resultado en una frase
    const factors = [
        { k: 'urgency', v: 0.35 * urgency }, { k: 'weight', v: 0.35 * weight },
        { k: 'complexity', v: 0.15 * complexity }, { k: 'risk', v: 0.15 * risk },
    ].sort((a, b) => b.v - a.v);
    const words = (k: string) => {
        if (k === 'urgency') {
            if (daysLeft < 0) return 'ya venció';
            if (daysLeft < 1) return 'vence en menos de 24 horas';
            const d = Math.ceil(daysLeft);
            return `vence en ${d} día${d === 1 ? '' : 's'}`;
        }
        if (k === 'weight') return `vale ${t.weightPct}% de la nota`;
        if (k === 'complexity') return 'es de alta complejidad';
        return 'la materia necesita refuerzo';
    };
    const sentence = `${words(factors[0].k)} y ${words(factors[1].k)}`;
    return {
        score: Math.round(100 * (0.35 * urgency + 0.35 * weight + 0.15 * complexity + 0.15 * risk) * 10) / 10,
        reason: sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.',
    };
}