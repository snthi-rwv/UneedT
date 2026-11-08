import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class GradeEntryDto {
    @IsOptional() @IsString() @MaxLength(60) label?: string; // ej.: "Parcial 1"
    @IsNumber({}, { message: 'El porcentaje debe ser un número' }) @Min(0.1, { message: 'El porcentaje debe ser mayor que 0' }) @Max(100) percent: number;
    @IsNumber({}, { message: 'La nota debe ser un número' }) @Min(0, { message: 'La nota va de 0.0 a 5.0' }) @Max(5, { message: 'La nota va de 0.0 a 5.0' }) grade: number;
}

// "Validar": se guardan todas las notas de la materia de una vez
export class SaveGradesDto {
    @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => GradeEntryDto) entries: GradeEntryDto[];
    @IsOptional() @IsNumber() @Min(3, { message: 'La meta debe ser de 3.0 a 5.0' }) @Max(5, { message: 'La meta debe ser de 3.0 a 5.0' }) targetGrade?: number;
}
