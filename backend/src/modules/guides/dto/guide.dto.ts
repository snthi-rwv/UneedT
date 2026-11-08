import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Llega como multipart/form-data (puede traer un archivo), por eso todo viene como texto
export class GuideDto {
    @IsOptional() @IsString() @MaxLength(4000, { message: 'El contexto puede tener máximo 4000 caracteres.' }) context?: string; // si no viene, se conserva el anterior
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) difficulty?: number; // qué tanto se le dificulta (1 a 5)
    @IsOptional() @IsIn(['1']) start?: string; // viene del botón "Empezar": la tarea pasa a "En curso"
    @IsOptional() @IsIn(['1']) removeFile?: string; // el estudiante quitó el archivo que había adjuntado antes
}

export const STEP_ACTIONS = ['start', 'pause', 'finish', 'undo', 'adjust'] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export class StepActionDto {
    @IsIn(STEP_ACTIONS) action: StepAction;
    @IsOptional() @IsInt() @Min(0) @Max(600) minutes?: number; // solo para "adjust": tiempo real que el estudiante dice que dedicó
}
