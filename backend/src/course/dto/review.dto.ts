import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReviewResultDto {
  @ApiProperty()
  @IsUUID()
  lessonId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty()
  @IsBoolean()
  correct: boolean;

  @ApiPropertyOptional({ description: 'What was answered (kept when wrong)' })
  @IsOptional()
  @IsObject()
  answer?: Record<string, unknown>;
}

export class SubmitReviewDto {
  @ApiProperty({ type: [ReviewResultDto] })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ReviewResultDto)
  results: ReviewResultDto[];
}
