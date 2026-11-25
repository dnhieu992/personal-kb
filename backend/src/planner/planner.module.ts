import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { TelegramModule } from '../telegram/telegram.module';
import {
  PlannerAttachment,
  PlannerCategory,
  PlannerChecklistItem,
  PlannerCorrection,
  PlannerGoal,
  PlannerNote,
  PlannerProject,
  PlannerRecurrence,
  PlannerTask,
} from './entities/planner.entities';
import { PlannerReminderService } from './planner-reminder.service';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlannerCategory,
      PlannerTask,
      PlannerChecklistItem,
      PlannerAttachment,
      PlannerGoal,
      PlannerRecurrence,
      PlannerNote,
      PlannerProject,
      PlannerCorrection,
    ]),
    AiModule,
    TelegramModule,
  ],
  controllers: [PlannerController],
  providers: [PlannerService, PlannerReminderService],
})
export class PlannerModule {}
