import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../entities/task.entity';

/** `date` columns want a plain YYYY-MM-DD, not a full ISO timestamp. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTaskDto {
  @ApiProperty({ example: 'Review the billing migration PR' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Optional Markdown detail' })
  @IsOptional()
  @ValidateIf((o) => o.notes !== null)
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TaskCategory })
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @ApiPropertyOptional({
    example: '2026-08-11',
    description: 'Day this is planned for. Send null to move it to the backlog.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.planDate !== null)
  @Matches(DATE_ONLY, { message: 'planDate must be YYYY-MM-DD' })
  planDate?: string | null;

  @ApiPropertyOptional({ example: '2026-08-20', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== null)
  @Matches(DATE_ONLY, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'Long-term list to file this under. Null = standalone task.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.listId !== null)
  @IsUUID()
  listId?: string | null;

  @ApiPropertyOptional({
    default: true,
    description:
      'Let the AI correct the title/notes into English in the background and ' +
      'collect the grammar and vocabulary to revise. Send false to keep the ' +
      'text exactly as typed and skip both.',
  })
  @IsOptional()
  @IsBoolean()
  autoCoach?: boolean;
}
