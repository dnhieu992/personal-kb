import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, Max, Min } from 'class-validator';

export class SubmitPlacementDto {
  @ApiProperty({ description: 'itemId → chosen option; items left out count as wrong', example: { 'a2-g1': 'am fixing' } })
  @IsObject()
  answers: Record<string, string>;
}

export class EfsetScoreDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;
}
