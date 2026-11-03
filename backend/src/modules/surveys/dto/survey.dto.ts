import { IsInt, Max, Min } from 'class-validator';

export class CreateSurveyDto {
    @IsInt() @Min(1) @Max(5) score: number;
}