import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Weak-point lessons first instead of path order' })
  @IsOptional()
  @IsBoolean()
  weakFirst?: boolean;
}
