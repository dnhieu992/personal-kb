import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { Knowledge, KnowledgeType } from './entities/knowledge.entity';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(Knowledge)
    private readonly repo: Repository<Knowledge>,
    private readonly ai: AiService,
    private readonly embedding: EmbeddingService,
  ) {}

  /** Run AI enrichment then persist + embed. */
  async create(dto: CreateKnowledgeDto): Promise<Knowledge> {
    const enrichment = await this.ai.enrich(dto.title, dto.content);
    const entity = this.repo.create({
      title: dto.title,
      content: dto.content,
      type: dto.type ?? KnowledgeType.INSIGHT,
      // Honour user-supplied tags, otherwise use the AI's.
      tags: dto.tags?.length ? dto.tags : enrichment.tags,
      summary: enrichment.summary,
      codeSnippets: enrichment.codeSnippets,
      projectId: dto.projectId ?? null,
    });
    const saved = await this.repo.save(entity);
    await this.embedToQdrant(saved);
    return saved;
  }

  /** List, optionally filtered by type, tag and/or project. */
  async findAll(
    type?: KnowledgeType,
    tag?: string,
    projectId?: string,
  ): Promise<Knowledge[]> {
    const qb = this.repo.createQueryBuilder('k').orderBy('k.createdAt', 'DESC');
    if (type) qb.andWhere('k.type = :type', { type });
    if (projectId) qb.andWhere('k.projectId = :projectId', { projectId });
    let rows = await qb.getMany();
    if (tag) {
      rows = rows.filter((r) => (r.tags ?? []).includes(tag));
    }
    return rows;
  }

  async findOne(id: string): Promise<Knowledge> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Knowledge ${id} not found`);
    return entry;
  }

  async update(id: string, dto: UpdateKnowledgeDto): Promise<Knowledge> {
    const entry = await this.findOne(id);
    const titleOrContentChanged =
      (dto.title && dto.title !== entry.title) ||
      (dto.content && dto.content !== entry.content);

    Object.assign(entry, {
      title: dto.title ?? entry.title,
      content: dto.content ?? entry.content,
      type: dto.type ?? entry.type,
      tags: dto.tags ?? entry.tags,
      // undefined → leave as-is; null → unfile from its project.
      projectId: dto.projectId === undefined ? entry.projectId : dto.projectId,
    });

    // Re-run enrichment if the body changed.
    if (titleOrContentChanged) {
      const enrichment = await this.ai.enrich(entry.title, entry.content);
      entry.summary = enrichment.summary;
      entry.codeSnippets = enrichment.codeSnippets;
      if (!dto.tags?.length) entry.tags = enrichment.tags;
    }

    const saved = await this.repo.save(entry);
    await this.embedToQdrant(saved);
    return saved;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const entry = await this.findOne(id);
    await this.repo.remove(entry);
    await this.embedding.remove(id);
    return { deleted: true };
  }

  /** Semantic search via Qdrant, hydrated with full rows from MySQL. */
  async search(query: string): Promise<Array<Knowledge & { score: number }>> {
    const hits = await this.embedding.search(query, 5);
    if (!hits.length) return [];
    const rows = await this.repo.find({
      where: { id: In(hits.map((h) => h.id)) },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return hits
      .map((h) => {
        const row = byId.get(h.id);
        return row ? { ...row, score: Number(h.score.toFixed(3)) } : null;
      })
      .filter((r): r is Knowledge & { score: number } => !!r);
  }

  /** Dashboard statistics. */
  async stats() {
    const all = await this.repo.find();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const tagCounts = new Map<string, number>();
    for (const e of all) {
      for (const tag of e.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const popularTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    return {
      total: all.length,
      today: all.filter((e) => e.createdAt >= startOfDay).length,
      popularTags,
      recent: all
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    };
  }

  private async embedToQdrant(entry: Knowledge): Promise<void> {
    // Embed title + content for the richest semantic signal.
    await this.embedding.upsert(entry.id, `${entry.title}\n\n${entry.content}`, {
      title: entry.title,
      summary: entry.summary ?? '',
      type: entry.type,
      tags: entry.tags ?? [],
      projectId: entry.projectId ?? null,
    });
  }
}
