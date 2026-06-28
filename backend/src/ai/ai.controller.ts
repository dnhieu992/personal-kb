import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Knowledge } from '../knowledge/entities/knowledge.entity';
import { EmbeddingService } from '../embedding/embedding.service';
import { AiService } from './ai.service';
import { ChatDto, SuggestTagsDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    @InjectRepository(Knowledge)
    private readonly repo: Repository<Knowledge>,
    private readonly embedding: EmbeddingService,
    private readonly ai: AiService,
  ) {}

  @Post('suggest-tags')
  @ApiOperation({ summary: 'Suggest tags from pasted content (used by the editor)' })
  async suggestTags(@Body() dto: SuggestTagsDto): Promise<{ tags: string[] }> {
    return { tags: await this.ai.suggestTags(dto.content) };
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Ask a natural-language question; RAG over the knowledge base',
  })
  async chat(@Body() dto: ChatDto) {
    // 1. Semantic retrieval from Qdrant.
    const hits = await this.embedding.search(dto.question, 5);

    // 2. Load the full entries from MySQL (Qdrant only stores summaries).
    const ids = hits.map((h) => h.id);
    const entries = ids.length
      ? await this.repo.find({ where: { id: In(ids) } })
      : [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    const ordered = hits
      .map((h) => byId.get(h.id))
      .filter((e): e is Knowledge => !!e);

    // 3. Claude synthesises the answer from the retrieved context.
    const answer = await this.ai.answer(
      dto.question,
      ordered.map((e) => ({ title: e.title, content: e.content })),
    );

    return {
      answer,
      sources: hits.map((h) => ({
        id: h.id,
        title: h.title,
        score: Number(h.score.toFixed(3)),
      })),
    };
  }
}
