import { CRITICAL_THRESHOLD, scoreTask } from '../src/modules/priority/priority.calculator';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

const casos = [
    { nombre: 'Parcial de Cálculo (30%, en 3 días)', t: { dueDate: inDays(3), weightPct: 30, complexity: 5, estimatedHours: 10, hoursSpent: 0 }, s: { difficulty: 5, currentGrade: 2.9 } },
    { nombre: 'Entrega final Web (35%, en 12 días)', t: { dueDate: inDays(12), weightPct: 35, complexity: 4, estimatedHours: 14, hoursSpent: 0 }, s: { difficulty: 2, currentGrade: 4.5 } },
    { nombre: 'Quiz de React (5%, mañana)', t: { dueDate: inDays(1), weightPct: 5, complexity: 1, estimatedHours: 1, hoursSpent: 0 }, s: { difficulty: 2, currentGrade: 4.5 } },
];

for (const c of casos) {
    const r = scoreTask(c.t, c.s);
    console.log(`${c.nombre}\n  puntaje: ${r.score}  ${r.score >= CRITICAL_THRESHOLD ? '(CRÍTICA)' : ''}\n  motivo:  ${r.reason}\n`);
}