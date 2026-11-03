import { Module } from '@nestjs/common';
import { SurveysController } from './surveys.controller';
import { SurveysRepository } from './surveys.repository';
import { SurveysService } from './surveys.service';

@Module({ controllers: [SurveysController], providers: [SurveysRepository, SurveysService] })
export class SurveysModule {}