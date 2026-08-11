import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskCategory } from '../entities/task.entity';
import { DATE_ONLY } from './create-task.dto';

export class CreateTaskListDto {
  @ApiProperty({ example: 'Ship the billing revamp' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Everything left before the September launch' })
  @IsOptional()
  @ValidateIf((o) => o.description !== null)
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskCategory })
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @ApiPropertyOptional({ example: '2026-09-30', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.targetDate !== null)
  @Matches(DATE_ONLY, { message: 'targetDate must be YYYY-MM-DD' })
  targetDate?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
