import { IsBoolean, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

export class GeneratePlanDto {
    @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe ser AAAA-MM-DD' }) date?: string;
    @IsNumber() @Min(0.5) @Max(14) availableHours: number;
    @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida (HH:mm)' }) startTime?: string;
}

export class UpdateBlockDto {
    @IsBoolean() done: boolean;
}