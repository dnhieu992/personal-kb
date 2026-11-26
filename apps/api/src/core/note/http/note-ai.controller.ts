import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { NoteAiInput } from '@pkb/contracts';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { NoteAiService } from '../application/note-ai.service';
import { NoteService } from '../application/note.service';

/** AI helpers for the note editor. Stateless: they read the draft from the body, save nothing. */
@Controller('notes/ai')
export class NoteAiController {
  constructor(private readonly ai: NoteAiService, private readonly notes: NoteService) {}

  @Post('suggest-tags')
  @HttpCode(200)
  async suggestTags(@Body(new ZodPipe(NoteAiInput)) body: NoteAiInput) {
    const existing = (await this.notes.allTags()).map((t) => t.name);
    return this.ai.suggestTags(body, existing);
  }

  @Post('summarize')
  @HttpCode(200)
  summarize(@Body(new ZodPipe(NoteAiInput)) body: NoteAiInput) {
    return this.ai.summarize(body);
  }

  @Post('rewrite')
  @HttpCode(200)
  rewrite(@Body(new ZodPipe(NoteAiInput)) body: NoteAiInput) {
    return this.ai.rewrite(body);
  }
}
