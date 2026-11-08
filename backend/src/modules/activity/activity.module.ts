import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';

// Tiempo de estudio por día: racha y tablero de progreso
@Module({ controllers: [ActivityController], providers: [ActivityRepository, ActivityService], exports: [ActivityService] })
export class ActivityModule {}
