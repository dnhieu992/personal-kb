import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

/** Ticking a task off is the one write that must stay instant — no AI, no re-coach. */
export class UpdateStatusDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
