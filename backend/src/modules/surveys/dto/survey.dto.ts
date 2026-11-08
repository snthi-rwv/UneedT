import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateSurveyDto {
    @IsInt() @Min(1) @Max(5) score: number; // agobio (indicador de la Matriz de Marco Lógico)
    @IsOptional() @IsInt() @Min(1) @Max(5) concentration?: number;
    @IsOptional() @IsInt() @Min(1) @Max(5) performance?: number;
}
