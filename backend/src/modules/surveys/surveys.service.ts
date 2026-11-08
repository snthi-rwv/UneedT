import { Injectable } from '@nestjs/common';
import { SurveyAnswers, SurveysRepository } from './surveys.repository';

const bogotaDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

@Injectable()
export class SurveysService {
    constructor(private readonly repo: SurveysRepository) {}

    /**
     * Una respuesta por día: si ya respondió hoy, se actualiza la de hoy.
     * La primera respuesta de la historia es la línea base del agobio; las demás, seguimiento.
     */
    async create(userId: string, a: SurveyAnswers) {
        const last = await this.repo.latest(userId);
        if (last && bogotaDate(last.createdAt) === bogotaDate(new Date())) return this.repo.update(last.id, a);
        return this.repo.create(userId, a, last ? 'FOLLOWUP' : 'BASELINE');
    }

    list(userId: string) { return this.repo.list(userId); }
}
