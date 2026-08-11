import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { TaskListService } from './task-list.service';
import { TaskService } from './task.service';

@ApiTags('task-lists')
@Controller('task-lists')
export class TaskListController {
  constructor(
    private readonly service: TaskListService,
    private readonly tasks: TaskService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a long-term todo list' })
  create(@Body() dto: CreateTaskListDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List todo lists (with task/done counts)' })
  @ApiQuery({ name: 'includeArchived', required: false })
  findAll(@Query('includeArchived') includeArchived?: string) {
    return this.service.findAll(includeArchived === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single todo list' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Tasks filed under this list' })
  tasksOf(@Param('id') id: string) {
    return this.tasks.findAll({ listId: id });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a todo list' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskListDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a list (its tasks are unfiled, not deleted)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
