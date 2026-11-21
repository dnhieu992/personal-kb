import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

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
}
