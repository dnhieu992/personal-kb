import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SubmitAttemptDto {
  @ApiProperty({ description: 'Exercises answered correctly' })
  @IsInt()
  @Min(0)
  correct: number;

  @ApiProperty({ description: 'Exercises in the run' })
  @IsInt()
  @Min(1)
  total: number;

  @ApiPropertyOptional({ description: 'Per-exercise answers, kept for history' })
  @IsOptional()
  @IsArray()
  answers?: unknown[];

  @ApiPropertyOptional({ description: 'Quick check of a lesson the placement test marked as mastered (needs ≥ 80%)' })
  @IsOptional()
  @IsBoolean()
  quick?: boolean;
}

export class GradeWritingDto {
  @ApiProperty({ description: 'Index of the writing exercise in the lesson' })
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}

export class GradeSummaryDto {
  @ApiProperty({ description: 'The learner’s summary of the listening passage (English)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @ApiPropertyOptional({ description: 'Comprehension questions answered right (kept with the grade)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  questionsCorrect?: number;
}
