import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Ajustes que el estudiante puede hacer antes de aceptar una propuesta
export class AcceptProposalDto {
    @IsOptional() @IsString() @MaxLength(160) title?: string;
    @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
    @IsOptional() @IsNumber() @Min(0) @Max(100) weightPct?: number;
    @IsOptional() @IsInt() @Min(1) @Max(5) complexity?: number;
    @IsOptional() @IsNumber() @Min(0.25) @Max(100) estimatedHours?: number;
    @IsOptional() @IsString() @MaxLength(80) subjectName?: string;
}