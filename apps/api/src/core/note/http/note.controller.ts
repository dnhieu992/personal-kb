import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateNoteInput, NoteListQuery, RequestUploadInput, UpdateNoteInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { AttachmentService } from '../application/attachment.service';
import { NoteService } from '../application/note.service';

@Controller()
export class NoteController {
  constructor(private readonly notes: NoteService, private readonly attachments: AttachmentService) {}

  @Get('notes')
  list(@Query(new ZodPipe(NoteListQuery)) q: NoteListQuery) {
    return this.notes.list(q);
  }

  @Post('notes')
  create(@Body(new ZodPipe(CreateNoteInput)) body: CreateNoteInput) {
    return this.notes.create(body);
  }

  @Get('notes/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.notes.detail(id);
  }

  @Patch('notes/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateNoteInput)) body: UpdateNoteInput) {
    return this.notes.update(id, body);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notes.remove(id);
  }

  @Get('tags')
  tags() {
    return this.notes.allTags();
  }

  @Post('notes/:id/attachments')
  requestUpload(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(RequestUploadInput)) body: RequestUploadInput) {
    return this.attachments.requestUpload(id, body);
  }
}
