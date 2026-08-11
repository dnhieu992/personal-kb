import { ApiPropertyOptional } from '@nestjs/swagger';
import { Matches, ValidateIf } from 'class-validator';
import { DATE_ONLY } from './create-task.dto';

/** Move a task to another day, or to the backlog with `null`. */
export class UpdateScheduleDto {
  @ApiPropertyOptional({
    example: '2026-08-12',
    nullable: true,
    description: 'Null moves the task to the unplanned backlog',
  })
  @ValidateIf((o) => o.planDate !== null)
  @Matches(DATE_ONLY, { message: 'planDate must be YYYY-MM-DD' })
  planDate: string | null;
}
