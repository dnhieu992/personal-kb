import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { EnglishModule } from '../english/english.module';
import { TaskList } from './entities/task-list.entity';
import { Task } from './entities/task.entity';
import { TaskListController } from './task-list.controller';
import { TaskListService } from './task-list.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskList]), AiModule, EnglishModule],
  controllers: [TaskController, TaskListController],
  providers: [TaskService, TaskListService],
  exports: [TaskService],
})
export class TaskModule {}
