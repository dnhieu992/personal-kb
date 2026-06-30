import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { CefrLevel, Knowledge, KnowledgeType } from './entities/knowledge.entity';

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
    const type = dto.type ?? KnowledgeType.INSIGHT;
    const entity = this.repo.create({
      title: dto.title,
      content: dto.content,
      type,
      projectId: dto.projectId ?? null,
    });

    if (type === KnowledgeType.ENGLISH) {
      const assessment = await this.ai.assessEnglish(dto.content);
      entity.summary = assessment.meaning;
      entity.cefrLevel = assessment.cefrLevel;
      entity.tags = dto.tags?.length ? dto.tags : assessment.tags;
      entity.codeSnippets = [];
    } else {
      const enrichment = await this.ai.enrich(dto.title, dto.content);
      // Honour user-supplied tags, otherwise use the AI's.
      entity.tags = dto.tags?.length ? dto.tags : enrichment.tags;
      entity.summary = enrichment.summary;
      entity.codeSnippets = enrichment.codeSnippets;
    }

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
      if (entry.type === KnowledgeType.ENGLISH) {
        const assessment = await this.ai.assessEnglish(entry.content);
        entry.summary = assessment.meaning;
        entry.cefrLevel = assessment.cefrLevel;
        if (!dto.tags?.length) entry.tags = assessment.tags;
      } else {
        const enrichment = await this.ai.enrich(entry.title, entry.content);
        entry.summary = enrichment.summary;
        entry.codeSnippets = enrichment.codeSnippets;
        if (!dto.tags?.length) entry.tags = enrichment.tags;
      }
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

  // ---------------------------------------------------------------------------
  // English journey
  // ---------------------------------------------------------------------------

  /**
   * Flashcard review queue: least-recently-seen English sentences first
   * (never-reviewed rows have a null lastReviewedAt and sort first).
   */
  async englishReviewQueue(limit = 20): Promise<Knowledge[]> {
    return this.repo
      .createQueryBuilder('k')
      .where('k.type = :type', { type: KnowledgeType.ENGLISH })
      // NULLs first so brand-new cards lead; then oldest review, then oldest card.
      .orderBy('k.lastReviewedAt IS NULL', 'DESC')
      .addOrderBy('k.lastReviewedAt', 'ASC')
      .addOrderBy('k.createdAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Record the result of reviewing one flashcard (no re-embed needed). */
  async recordReview(id: string, remembered: boolean): Promise<Knowledge> {
    const entry = await this.findOne(id);
    entry.reviewCount = (entry.reviewCount ?? 0) + 1;
    if (remembered) entry.correctCount = (entry.correctCount ?? 0) + 1;
    entry.lastReviewedAt = new Date();
    return this.repo.save(entry);
  }

  /** English-journey dashboard: level distribution, accuracy, weekly trend. */
  async englishStats() {
    const rows = await this.repo.find({
      where: { type: KnowledgeType.ENGLISH },
    });

    const byLevel = Object.values(CefrLevel).reduce(
      (acc, lvl) => ({ ...acc, [lvl]: 0 }),
      {} as Record<CefrLevel, number>,
    );
    let reviews = 0;
    let correct = 0;
    let dueForReview = 0;
    for (const r of rows) {
      if (r.cefrLevel) byLevel[r.cefrLevel] += 1;
      reviews += r.reviewCount ?? 0;
      correct += r.correctCount ?? 0;
      if (!r.lastReviewedAt) dueForReview += 1;
    }

    // New sentences per day for the last 7 days (oldest → newest).
    const weekly: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      weekly.push({
        date: day.toISOString().slice(0, 10),
        count: rows.filter(
          (r) => r.createdAt >= day && r.createdAt < next,
        ).length,
      });
    }

    return {
      total: rows.length,
      byLevel,
      reviewAccuracy: reviews ? Math.round((correct / reviews) * 100) : 0,
      dueForReview,
      weekly,
    };
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
