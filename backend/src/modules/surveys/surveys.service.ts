import { Injectable } from '@nestjs/common';
import { SurveysRepository } from './surveys.repository';

@Injectable()
export class SurveysService {
    constructor(private readonly repo: SurveysRepository) {}

    // La primera respuesta es la línea base; las demás, seguimiento
    async create(userId: string, score: number) {
        const kind = (await this.repo.count(userId)) ? 'FOLLOWUP' : 'BASELINE';
        return this.repo.create(userId, score, kind);
    }

    list(userId: string) { return this.repo.list(userId); }
}