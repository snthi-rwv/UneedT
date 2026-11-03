import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';

/** Calcula los indicadores de la Matriz de Marco Lógico (Fin y Propósito) para un usuario. */
@Injectable()
export class AnalyticsService {
    constructor(private readonly repo: AnalyticsRepository) {}

    async summary(userId: string) {
        const now = new Date();
        const [tasks, surveys] = await Promise.all([this.repo.tasks(userId), this.repo.surveys(userId)]);

        // Fin 1: tareas críticas a tiempo vs. tardías o vencidas sin entregar
        const critical = tasks.filter((t) => t.critical);
        const onTime = critical.filter((t) => t.status === 'DONE' && t.completedAt && t.completedAt <= t.dueDate).length;
        const late = critical.filter((t) => (t.status === 'DONE' && t.completedAt! > t.dueDate) || (t.status !== 'DONE' && t.dueDate < now)).length;

        // Fin 2: cambio en la puntuación de agobio (primera respuesta vs. la más reciente)
        const baseline = surveys[0]?.score ?? null;
        const latest = surveys.length > 1 ? surveys[surveys.length - 1].score : null;

        return {
            tasks: {
                total: tasks.length,
                done: tasks.filter((t) => t.status === 'DONE').length,
                open: tasks.filter((t) => t.status !== 'DONE').length,
            },
            criticalOnTimePct: onTime + late ? Math.round((onTime / (onTime + late)) * 100) : null, // meta: >= 80
            emailCapturedPct: tasks.length ? Math.round((tasks.filter((t) => t.source === 'EMAIL').length / tasks.length) * 100) : 0, // meta: >= 30
            hoursStudied: Math.round(tasks.reduce((s, t) => s + t.hoursSpent, 0) * 10) / 10,
            stress: { baseline, latest, delta: baseline != null && latest != null ? latest - baseline : null }, // meta: -1 punto
        };
    }
}