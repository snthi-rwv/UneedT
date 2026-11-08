import { Injectable } from '@nestjs/common';
import { ActivityRepository } from './activity.repository';
import { streak } from './streak.calc';

export const bogotaDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // AAAA-MM-DD

/**
 * Registro del tiempo de estudio por día. Lo alimentan el cronómetro, los pasos terminados y los bloques del plan.
 * Sirve para la racha del panel y para el tablero de Progreso.
 */
@Injectable()
export class ActivityService {
    constructor(private readonly repo: ActivityRepository) {}

    /** Suma tiempo estudiado al día de hoy (negativo para descontar). Nunca rompe la acción que lo llama. */
    async log(userId: string, seconds: number, at = new Date()) {
        const s = Math.round(seconds);
        if (!s) return;
        try { await this.repo.addSeconds(userId, bogotaDate(at), s); } catch { /* el registro es secundario */ }
    }

    async streak(userId: string) {
        return streak(await this.repo.days(userId), bogotaDate());
    }

    // Minutos por día de los últimos N días (incluye los días sin estudio, en 0)
    async days(userId: string, count: number) {
        const today = new Date();
        const dates = Array.from({ length: count }, (_, i) => bogotaDate(new Date(today.getTime() - (count - 1 - i) * 86_400_000)));
        const rows = new Map((await this.repo.days(userId, dates[0])).map((d) => [d.date, d.seconds]));
        return dates.map((date) => ({ date, minutes: Math.round((rows.get(date) ?? 0) / 60) }));
    }
}
