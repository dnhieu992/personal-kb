import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateRecurrenceInput, UpdateRecurrenceInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { RecurrenceService } from '../application/recurrence.service';

@Controller('recurrences')
export class RecurrenceController {
  constructor(private readonly recurrences: RecurrenceService) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.recurrences.list(projectId || undefined);
  }

  @Post()
  create(@Body(new ZodPipe(CreateRecurrenceInput)) body: CreateRecurrenceInput) {
    return this.recurrences.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.recurrences.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateRecurrenceInput)) body: UpdateRecurrenceInput) {
    return this.recurrences.update(id, body);
  }
}
