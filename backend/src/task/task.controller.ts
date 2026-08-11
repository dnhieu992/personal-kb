import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCategory, TaskStatus } from './entities/task.entity';
import { TaskService } from './task.service';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a task (saved instantly; English coaching runs in the background)',
  })
  create(@Body() dto: CreateTaskDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks, optionally filtered' })
  @ApiQuery({ name: 'date', required: false, example: '2026-08-11' })
  @ApiQuery({ name: 'category', enum: TaskCategory, required: false })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiQuery({ name: 'listId', required: false })
  @ApiQuery({ name: 'unplanned', required: false, description: 'true = backlog only' })
  findAll(
    @Query('date') date?: string,
    @Query('category') category?: TaskCategory,
    @Query('status') status?: TaskStatus,
    @Query('listId') listId?: string,
    @Query('unplanned') unplanned?: string,
  ) {
    return this.service.findAll({
      date,
      category,
      status,
      listId,
      unplanned: unplanned === 'true',
    });
  }

  // Declared before :id so "/day" and "/stats" are not matched as an id.
  @Get('day')
  @ApiOperation({ summary: "A day's plan plus unfinished tasks carried over" })
  @ApiQuery({ name: 'date', required: false, description: 'Defaults to today' })
  day(@Query('date') date?: string) {
    return this.service.day(date || undefined);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Planner stats: today, backlog, overdue, 7-day trend' })
  @ApiQuery({ name: 'date', required: false, description: 'Defaults to today' })
  stats(@Query('date') date?: string) {
    return this.service.stats(date || undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/collected')
  @ApiOperation({ summary: 'English review cards collected from this task' })
  collected(@Param('id') id: string) {
    return this.service.collected(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a task (editing the title/notes re-runs the English pass)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Tick a task off (or reopen it) — no AI work' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Move a task to another day, or to the backlog' })
  reschedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.reschedule(id, dto.planDate);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task (+ the review cards it produced)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
