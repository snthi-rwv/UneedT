import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { PriorityModule } from './modules/priority/priority.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { StudyPlanModule } from './modules/study-plan/study-plan.module';
import { HealthModule } from './modules/health/health.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), // límite general por IP
        DatabaseModule,
        CommonModule,
        AuthModule,
        PriorityModule,
        SubjectsModule,
        TasksModule,
        StudyPlanModule,
        HealthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}