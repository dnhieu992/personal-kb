import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CefrLevel } from '../../knowledge/entities/knowledge.entity';

export class SetGoalDto {
  @ApiPropertyOptional({ enum: CefrLevel, description: 'Defaults to the current start / placement level' })
  @IsOptional()
  @IsEnum(CefrLevel)
  startLevel?: CefrLevel;

  @ApiProperty({ enum: CefrLevel })
  @IsEnum(CefrLevel)
  targetLevel: CefrLevel;

  @ApiProperty({ minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  weeklyLessons: number;
}
