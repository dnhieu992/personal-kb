import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateChecklistItemInput, UpdateChecklistItemInput } from '@pkb/contracts';
import { z } from 'zod';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { TaskService } from '../application/task.service';

@Controller()
export class ChecklistController {
  constructor(private readonly tasks: TaskService) {}

  @Post('tasks/:id/checklist')
  add(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(CreateChecklistItemInput)) body: z.infer<typeof CreateChecklistItemInput>) {
    return this.tasks.addChecklistItem(id, body.title);
  }

  @Patch('checklist/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateChecklistItemInput)) body: UpdateChecklistItemInput) {
    return this.tasks.updateChecklistItem(id, body);
  }

  @Delete('checklist/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.removeChecklistItem(id);
  }
}
