import { allocateMinutes } from '../src/modules/study-plan/plan-allocator';

const tareas = [
    { id: 'Parcial (95 pts, faltan 10 h)', priorityScore: 95, pendingMinutes: 600 },
    { id: 'Entrega final (66 pts, faltan 14 h)', priorityScore: 66, pendingMinutes: 840 },
    { id: 'Quiz (44 pts, falta 1 h)', priorityScore: 44, pendingMinutes: 60 },
];

for (const horas of [6, 2, 0.5]) {
    const r = allocateMinutes(tareas, horas * 60);
    const total = [...r.values()].reduce((s, m) => s + m, 0);
    console.log(`\nDisponible: ${horas} h (${horas * 60} min)`);
    for (const [id, m] of r) console.log(`  ${String(m).padStart(4)} min  ${id}`);
    console.log(`  total asignado: ${total} min`);
}