import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
    @IsString() @MinLength(2) @MaxLength(160) title: string;
    @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @IsOptional() @IsString() subjectId?: string;
    @Type(() => Date) @IsDate({ message: 'Fecha de entrega inválida' }) dueDate: Date;
    @IsNumber() @Min(0) @Max(100) weightPct: number;
    @IsInt() @Min(1) @Max(5) complexity: number;
    @IsNumber() @Min(0.25) @Max(100) estimatedHours: number;
}

export class UpdateTaskDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
    @IsOptional() @IsString() @MaxLength(2000) description?: string;
    @IsOptional() @IsString() subjectId?: string | null;
    @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
    @IsOptional() @IsNumber() @Min(0) @Max(100) weightPct?: number;
    @IsOptional() @IsInt() @Min(1) @Max(5) complexity?: number;
    @IsOptional() @IsNumber() @Min(0.25) @Max(100) estimatedHours?: number;
    @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}