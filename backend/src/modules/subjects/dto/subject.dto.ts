import { IsHexColor, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSubjectDto {
    @IsString() @MinLength(2) @MaxLength(80) name: string;
    @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: number;
    @IsOptional() @IsNumber() @Min(0) @Max(5) currentGrade?: number;
    @IsOptional() @IsHexColor() color?: string;
}

export class UpdateSubjectDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
    @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: number;
    @IsOptional() @IsNumber() @Min(0) @Max(5) currentGrade?: number | null;
    @IsOptional() @IsHexColor() color?: string;
}