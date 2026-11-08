import { PlanIntensity } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class GeneratePlanDto {
    @IsOptional() @Matches(DATE, { message: 'La fecha debe ser AAAA-MM-DD' }) date?: string;
    @IsNumber() @Min(0.5) @Max(14) availableHours: number;
    @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida (HH:mm)' }) startTime?: string;
    @IsOptional() @IsEnum(PlanIntensity, { message: 'Intensidad inválida' }) intensity?: PlanIntensity;
}

export class ReplanDto {
    @IsOptional() @Matches(DATE, { message: 'La fecha debe ser AAAA-MM-DD' }) date?: string;
}

export class UpdateBlockDto {
    @IsBoolean() done: boolean;
}
