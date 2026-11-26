import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '../project';
import { InstanceFactory } from './application/instance.factory';
import { RecurrenceService } from './application/recurrence.service';
import { TaskService } from './application/task.service';
import { ChecklistController } from './http/checklist.controller';
import { RecurrenceController } from './http/recurrence.controller';
import { TaskController } from './http/task.controller';
import { TodayController } from './http/today.controller';
import { ChecklistItemEntity } from './infra/checklist-item.entity';
import { RecurrenceEntity } from './infra/recurrence.entity';
import { TaskEntity } from './infra/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, ChecklistItemEntity, RecurrenceEntity]), ProjectModule],
  controllers: [TaskController, ChecklistController, RecurrenceController, TodayController],
  providers: [TaskService, RecurrenceService, InstanceFactory],
  exports: [TaskService],
})
export class TaskModule {}
