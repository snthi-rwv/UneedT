import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { PriorityModule } from './modules/priority/priority.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { StudyPlanModule } from './modules/study-plan/study-plan.module';
import { EmailSyncModule } from './modules/email-sync/email-sync.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { GuidesModule } from './modules/guides/guides.module';
import { ActivityModule } from './modules/activity/activity.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
        ScheduleModule.forRoot(), // necesario para el cron de sincronización
        ThrottlerModule.forRoot({
            throttlers: [{ ttl: 60_000, limit: 120 }], // límite general por IP
            errorMessage: 'Hiciste demasiadas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.',
        }),
        DatabaseModule,
        CommonModule,
        AuthModule,
        OAuthModule,
        PriorityModule,
        SubjectsModule,
        TasksModule,
        StudyPlanModule,
        EmailSyncModule,
        SurveysModule,
        AnalyticsModule,
        GuidesModule,
        ActivityModule,
        HealthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}