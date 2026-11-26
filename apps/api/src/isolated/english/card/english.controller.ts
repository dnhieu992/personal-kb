import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  CheckEnglishInput,
  CreateJournalInput,
  RecordMistakesInput,
  ReviewCardInput,
  UpdateCardInput,
} from '@pkb/contracts';
import { z } from 'zod';
import { ZodPipe } from '../../../platform/http/zod.pipe';
import { CheckService } from '../check/check.service';
import { CardService } from './card.service';

const limitOf = (v?: string) => (v ? Math.min(200, Math.max(1, Number(v) || 20)) : undefined);

/** /api/english/* — journal, review cards, Check English. Never touches core tables. */
@Controller('english')
export class EnglishController {
  constructor(
    private readonly cards: CardService,
    private readonly checker: CheckService,
  ) {}

  @Post('journal')
  createJournal(@Body(new ZodPipe(CreateJournalInput)) body: z.infer<typeof CreateJournalInput>) {
    return this.cards.ingestJournal(body);
  }

  @Get('journal')
  journal() {
    return this.cards.journalTimeline();
  }

  @Get('collected')
  collected(@Query('limit') limit?: string) {
    return this.cards.collectedBySource(limitOf(limit));
  }

  @Get('review')
  review(@Query('limit') limit?: string) {
    return this.cards.reviewQueue(limitOf(limit));
  }

  @Get('stats')
  stats() {
    return this.cards.stats();
  }

  @Get('corrections')
  corrections(@Query('limit') limit?: string) {
    return this.cards.listCorrections(limitOf(limit));
  }

  /** Proofread text; returns a diff the user accepts/rejects change by change. */
  @Post('check')
  check(@Body(new ZodPipe(CheckEnglishInput)) body: z.infer<typeof CheckEnglishInput>) {
    return this.checker.check(body.text);
  }

  /** Accepted fixes (+ chosen cards) → review cards. The one-way door from core editors. */
  @Post('mistakes')
  mistakes(@Body(new ZodPipe(RecordMistakesInput)) body: z.infer<typeof RecordMistakesInput>) {
    return this.cards.recordMistakes(body);
  }

  @Get('cards/:id')
  get(@Param('id') id: string) {
    return this.cards.get(id);
  }

  @Put('cards/:id')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdateCardInput)) body: z.infer<typeof UpdateCardInput>) {
    return this.cards.update(id, body);
  }

  @Delete('cards/:id')
  remove(@Param('id') id: string) {
    return this.cards.remove(id);
  }

  @Post('cards/:id/review')
  recordReview(@Param('id') id: string, @Body(new ZodPipe(ReviewCardInput)) body: z.infer<typeof ReviewCardInput>) {
    return this.cards.recordReview(id, body.remembered);
  }
}
