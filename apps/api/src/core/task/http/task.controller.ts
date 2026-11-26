import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateTaskInput, MoveTaskInput, TaskListQuery, TaskStatus, UpdateTaskInput } from '@pkb/contracts';
import { z } from 'zod';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { TaskService } from '../application/task.service';

const SetStatusInput = z.object({ status: TaskStatus });

@Controller('tasks')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  list(@Query(new ZodPipe(TaskListQuery)) q: TaskListQuery) {
    return this.tasks.list(q);
  }

  @Post()
  create(@Body(new ZodPipe(CreateTaskInput)) body: CreateTaskInput) {
    return this.tasks.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.detail(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateTaskInput)) body: UpdateTaskInput) {
    return this.tasks.update(id, body);
  }

  @Post(':id/move')
  move(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(MoveTaskInput)) body: MoveTaskInput) {
    return this.tasks.move(id, body);
  }

  @Post(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SetStatusInput)) body: z.infer<typeof SetStatusInput>) {
    return this.tasks.setStatus(id, body.status);
  }

  @Post(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.complete(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.remove(id);
  }
}
