import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AskInput, SearchQuery, SemanticQuery } from '@pkb/contracts';
import { ZodPipe } from '../../platform/http/zod.pipe';
import { AskService } from './ask.service';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(private readonly search: SearchService, private readonly asker: AskService) {}

  @Get('search')
  find(@Query(new ZodPipe(SearchQuery)) q: SearchQuery) {
    return this.search.search(q);
  }

  /** Meaning-based search over notes (+ attachment text). `enabled: false` when Qdrant is off. */
  @Get('search/semantic')
  semantic(@Query(new ZodPipe(SemanticQuery)) q: SemanticQuery) {
    return this.asker.semantic(q.q, q.limit);
  }

  /** RAG: answer a question from the most relevant passages, with numbered sources. */
  @Post('ask')
  @HttpCode(200)
  ask(@Body(new ZodPipe(AskInput)) body: AskInput) {
    return this.asker.ask(body.question);
  }
}
