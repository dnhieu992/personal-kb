import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AttachmentCreateDto,
  ChecklistCreateDto,
  ChecklistUpdateDto,
  CreateCategoryDto,
  CreateGoalDto,
  CreateNoteDto,
  CreateTaskDto,
  DayNoteDto,
  EnglishCheckDto,
  MoveTaskDto,
  RecurrenceDto,
  UpdateCategoryDto,
  UpdateGoalDto,
  UpdateNoteDto,
  UpdateTaskDto,
} from './dto/planner.dto';
import { AREAS, Area } from './entities/planner.entities';
import { addDays, endOfMonth, isDayKey, startOfMonth, startOfWeek } from './planner-dates';
import { PlannerService, TaskView } from './planner.service';

const VIEWS: TaskView[] = ['today', 'week', 'month', 'all', 'backlog', 'overdue', 'category', 'goal', 'search'];

function area(a?: string): Area | undefined {
  if (!a) return undefined;
  if (!(AREAS as readonly string[]).includes(a)) throw new BadRequestException(`area must be one of ${AREAS.join(', ')}`);
  return a as Area;
}

function optInt(v?: string): number | undefined {
  return v ? Number(v) : undefined;
}

/** Web version of the Planner Mac app: Work/Personal areas, tasks, board, goals, notes, stats. */
@ApiTags('planner')
@Controller('planner')
export class PlannerController {
  constructor(private readonly s: PlannerService) {}

  @Get('meta')
  @ApiOperation({ summary: 'Today key, categories and sidebar badge counts' })
  meta() {
    return this.s.meta();
  }

  // ── Categories
  @Post('categories')
  addCategory(@Body() dto: CreateCategoryDto) {
    return this.s.addCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Rename / recolor / move a category (moving takes its items along)' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.s.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category; its tasks are kept uncategorized' })
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteCategory(id);
  }

  // ── Tasks
  @Get('tasks')
  @ApiOperation({ summary: 'Tasks for a view (today/week/month/all/backlog/overdue/category/goal/search)' })
  @ApiQuery({ name: 'view', enum: VIEWS })
  @ApiQuery({ name: 'area', enum: AREAS, required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'goalId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'anchor', required: false, description: 'A day inside the week/month to show' })
  listTasks(
    @Query('view') view: TaskView,
    @Query('area') a?: string,
    @Query('categoryId') categoryId?: string,
    @Query('goalId') goalId?: string,
    @Query('q') q?: string,
    @Query('anchor') anchor?: string,
  ) {
    if (!VIEWS.includes(view)) throw new BadRequestException(`view must be one of ${VIEWS.join(', ')}`);
    return this.s.listTasks({
      view,
      area: area(a),
      categoryId: optInt(categoryId),
      goalId: optInt(goalId),
      q,
      anchor: isDayKey(anchor) ? anchor : undefined,
    });
  }

  @Get('board')
  @ApiOperation({ summary: 'Kanban columns for an area: backlog / doing / done (7 days)' })
  @ApiQuery({ name: 'area', enum: AREAS })
  board(@Query('area') a: string) {
    return this.s.board(area(a) ?? 'WORK');
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Add a task (quick-add syntax: #tag !!! @9:30); English check runs in background' })
  addTask(@Body() dto: CreateTaskDto) {
    return this.s.addTask(dto);
  }

  @Post('tasks/move-overdue')
  @ApiOperation({ summary: 'Move every overdue task (optionally of one area) to today' })
  @ApiQuery({ name: 'area', enum: AREAS, required: false })
  moveOverdue(@Query('area') a?: string) {
    return this.s.moveOverdueToToday(area(a));
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'A task with checklist, attachments, recurrence and last correction' })
  getTask(@Param('id', ParseIntPipe) id: number) {
    return this.s.getTask(id);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.s.updateTask(id, dto);
  }

  @Post('tasks/:id/move')
  @ApiOperation({ summary: 'Kanban drop onto a column' })
  move(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveTaskDto) {
    return this.s.moveToColumn(id, dto.column);
  }

  @Put('tasks/:id/recurrence')
  @ApiOperation({ summary: 'Make a task repeat (or stop the series with kind = null)' })
  recurrence(@Param('id', ParseIntPipe) id: number, @Body() dto: RecurrenceDto) {
    return this.s.setRecurrence(id, dto);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteTask(id);
  }

  @Post('tasks/:id/checklist')
  addChecklist(@Param('id', ParseIntPipe) id: number, @Body() dto: ChecklistCreateDto) {
    return this.s.addChecklistItem(id, dto.title);
  }

  @Patch('checklist/:id')
  updateChecklist(@Param('id', ParseIntPipe) id: number, @Body() dto: ChecklistUpdateDto) {
    return this.s.updateChecklistItem(id, dto);
  }

  @Delete('checklist/:id')
  deleteChecklist(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteChecklistItem(id);
  }

  @Post('tasks/:id/attachments')
  @ApiOperation({ summary: 'Attach a link, or an uploaded file URL' })
  addAttachment(@Param('id', ParseIntPipe) id: number, @Body() dto: AttachmentCreateDto) {
    return this.s.addAttachment(id, dto);
  }

  @Delete('attachments/:id')
  deleteAttachment(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteAttachment(id);
  }

  // ── Goals
  @Get('goals')
  @ApiQuery({ name: 'area', enum: AREAS, required: false })
  @ApiQuery({ name: 'open', required: false, description: 'true = unfinished only' })
  listGoals(@Query('area') a?: string, @Query('open') open?: string) {
    return this.s.listGoals(area(a), open === 'true');
  }

  @Get('goals/:id')
  getGoal(@Param('id', ParseIntPipe) id: number) {
    return this.s.getGoal(id);
  }

  @Post('goals')
  addGoal(@Body() dto: CreateGoalDto) {
    return this.s.addGoal(dto);
  }

  @Patch('goals/:id')
  updateGoal(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGoalDto) {
    return this.s.updateGoal(id, dto);
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: "Delete a goal; its tasks are kept" })
  deleteGoal(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteGoal(id);
  }

  // ── Notes
  @Get('notes')
  @ApiQuery({ name: 'area', enum: AREAS, required: false })
  @ApiQuery({ name: 'filter', enum: ['all', 'ideas', 'daily'], required: false })
  @ApiQuery({ name: 'q', required: false })
  listNotes(@Query('area') a?: string, @Query('filter') filter?: string, @Query('q') q?: string) {
    const f = filter === 'ideas' || filter === 'daily' ? filter : 'all';
    return this.s.listNotes(area(a), f, q);
  }

  @Get('day-note')
  @ApiQuery({ name: 'day' })
  @ApiQuery({ name: 'area', enum: AREAS })
  dayNote(@Query('day') day: string, @Query('area') a: string) {
    if (!isDayKey(day)) throw new BadRequestException('day must be YYYY-MM-DD');
    return this.s.dayNote(day, area(a) ?? 'WORK').then((n) => n ?? {});
  }

  @Put('day-note')
  @ApiOperation({ summary: 'Save the "notes for the day" of an area' })
  saveDayNote(@Body() dto: DayNoteDto) {
    return this.s.saveDayNote(dto.day, dto.area, dto.body).then((n) => n ?? {});
  }

  @Get('notes/:id')
  getNote(@Param('id', ParseIntPipe) id: number) {
    return this.s.getNote(id);
  }

  @Post('notes')
  addNote(@Body() dto: CreateNoteDto) {
    return this.s.addNote(dto);
  }

  @Patch('notes/:id')
  updateNote(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.s.updateNote(id, dto);
  }

  @Delete('notes/:id')
  deleteNote(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteNote(id);
  }

  @Post('notes/:id/to-task')
  @ApiOperation({ summary: 'Create a task for today from a note' })
  noteToTask(@Param('id', ParseIntPipe) id: number) {
    return this.s.noteToTask(id);
  }

  // ── Stats
  @Get('stats')
  @ApiQuery({ name: 'period', enum: ['week', 'month'] })
  @ApiQuery({ name: 'anchor', required: false, description: 'A day in the period (default today)' })
  @ApiQuery({ name: 'area', enum: AREAS, required: false })
  stats(@Query('period') period: string, @Query('anchor') anchor?: string, @Query('area') a?: string) {
    const p = period === 'month' ? 'month' : 'week';
    const day = isDayKey(anchor) ? anchor : this.s.today();
    const from = p === 'week' ? startOfWeek(day) : startOfMonth(day);
    const to = p === 'week' ? addDays(from, 6) : endOfMonth(day);
    return this.s.stats(from, to, p, area(a));
  }

  // ── English
  @Get('corrections')
  corrections() {
    return this.s.listCorrections();
  }

  @Post('corrections/:id/revert')
  @ApiOperation({ summary: 'Put the original text back (if it was not edited since)' })
  revert(@Param('id', ParseIntPipe) id: number) {
    return this.s.revertCorrection(id);
  }

  @Delete('corrections/:id')
  deleteCorrection(@Param('id', ParseIntPipe) id: number) {
    return this.s.deleteCorrection(id);
  }

  @Delete('corrections')
  clearCorrections() {
    return this.s.clearCorrections();
  }

  @Post('english/check')
  @ApiOperation({ summary: 'Correct a longer text (note body); with noteId it is applied + logged' })
  check(@Body() dto: EnglishCheckDto) {
    return this.s.checkText(dto.text, dto.noteId);
  }
}
