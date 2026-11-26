import { Controller, Get } from '@nestjs/common';
import { TaskService } from '../application/task.service';

@Controller('today')
export class TodayController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  today() {
    return this.tasks.today();
  }
}
