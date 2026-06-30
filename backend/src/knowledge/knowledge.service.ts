import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import {
  CefrLevel,
  EnglishKind,
  Knowledge,
  KnowledgeType,
  REVIEWABLE_KINDS,
} from './entities/knowledge.entity';

/** A journal diary entry together with the items the AI extracted from it. */
export interface JournalWithItems {
  journal: Knowledge;
  items: Knowledge[];
}

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

    // ENGLISH entries are free-form journal entries: extract + store review items.
    if (type === KnowledgeType.ENGLISH) {
      const { journal } = await this.ingestEnglishJournal(
        dto.content,
        dto.projectId ?? null,
      );
      return journal;
    }

    const enrichment = await this.ai.enrich(dto.title, dto.content);
    const entity = this.repo.create({
      title: dto.title,
      content: dto.content,
      type,
      projectId: dto.projectId ?? null,
      // Honour user-supplied tags, otherwise use the AI's.
      tags: dto.tags?.length ? dto.tags : enrichment.tags,
      summary: enrichment.summary,
      codeSnippets: enrichment.codeSnippets,
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

    // Re-run enrichment if the body changed. ENGLISH entries keep their existing
    // summary/level on edit (the journal extraction only runs at create time, so
    // hand-edits to an item or journal aren't silently overwritten).
    if (titleOrContentChanged && entry.type !== KnowledgeType.ENGLISH) {
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

    // Deleting a journal entry also removes the items extracted from it.
    if (entry.englishKind === EnglishKind.JOURNAL) {
      const items = await this.repo.find({ where: { sourceId: id } });
      for (const item of items) {
        const itemId = item.id; // repo.remove() clears the id off the entity
        await this.repo.remove(item);
        await this.embedding.remove(itemId);
      }
    }

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
   * Ingest a free-form journal entry: store it as a JOURNAL row, have the AI
   * summarise it and extract reviewable items, then store + embed each item
   * linked back to the journal. Used by both create() and the journal endpoint.
   */
  async ingestEnglishJournal(
    text: string,
    projectId: string | null = null,
  ): Promise<JournalWithItems> {
    const extraction = await this.ai.extractEnglishJournal(text);

    const journal = await this.repo.save(
      this.repo.create({
        title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
        content: text,
        type: KnowledgeType.ENGLISH,
        englishKind: EnglishKind.JOURNAL,
        summary: extraction.summary,
        tags: [],
        projectId,
      }),
    );
    await this.embedToQdrant(journal);

    const items: Knowledge[] = [];
    for (const it of extraction.items) {
      const item = await this.repo.save(
        this.repo.create({
          title: it.front.length > 80 ? `${it.front.slice(0, 77)}…` : it.front,
          content: it.front,
          type: KnowledgeType.ENGLISH,
          englishKind: it.kind,
          summary: it.meaning,
          cefrLevel: it.cefrLevel,
          hard: it.hard,
          sourceId: journal.id,
          tags: [],
          projectId,
        }),
      );
      await this.embedToQdrant(item);
      items.push(item);
    }

    return { journal, items };
  }

  /** Diary timeline: JOURNAL entries newest-first, each with its review items. */
  async englishJournal(): Promise<JournalWithItems[]> {
    const journals = await this.repo.find({
      where: { type: KnowledgeType.ENGLISH, englishKind: EnglishKind.JOURNAL },
      order: { createdAt: 'DESC' },
    });
    if (!journals.length) return [];

    const items = await this.repo.find({
      where: { sourceId: In(journals.map((j) => j.id)) },
      order: { createdAt: 'ASC' },
    });
    const bySource = new Map<string, Knowledge[]>();
    for (const item of items) {
      const list = bySource.get(item.sourceId!) ?? [];
      list.push(item);
      bySource.set(item.sourceId!, list);
    }

    return journals.map((journal) => ({
      journal,
      items: bySource.get(journal.id) ?? [],
    }));
  }

  /**
   * Flashcard review queue: only reviewable items (not journal entries).
   * Hard-flagged items lead, then least-recently-seen (never-reviewed first).
   */
  async englishReviewQueue(limit = 20): Promise<Knowledge[]> {
    return this.repo
      .createQueryBuilder('k')
      .where('k.type = :type', { type: KnowledgeType.ENGLISH })
      .andWhere('k.englishKind IN (:...kinds)', { kinds: REVIEWABLE_KINDS })
      // Hard items first; then NULL lastReviewedAt (new); then oldest review/card.
      .orderBy('k.hard', 'DESC')
      .addOrderBy('k.lastReviewedAt IS NULL', 'DESC')
      .addOrderBy('k.lastReviewedAt', 'ASC')
      .addOrderBy('k.createdAt', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Record the result of reviewing one flashcard (no re-embed needed). */
  async recordReview(id: string, remembered: boolean): Promise<Knowledge> {
    const entry = await this.findOne(id);
    entry.reviewCount = (entry.reviewCount ?? 0) + 1;
    if (remembered) {
      entry.correctCount = (entry.correctCount ?? 0) + 1;
      // Remembering an item clears its "hard" flag so it stops being prioritised.
      entry.hard = false;
    }
    entry.lastReviewedAt = new Date();
    return this.repo.save(entry);
  }

  /** English-journey dashboard: counts, level/kind distribution, accuracy, trend. */
  async englishStats() {
    const rows = await this.repo.find({
      where: { type: KnowledgeType.ENGLISH },
    });
    const journals = rows.filter(
      (r) => r.englishKind === EnglishKind.JOURNAL,
    );
    const items = rows.filter((r) =>
      REVIEWABLE_KINDS.includes(r.englishKind as EnglishKind),
    );

    const byLevel = Object.values(CefrLevel).reduce(
      (acc, lvl) => ({ ...acc, [lvl]: 0 }),
      {} as Record<CefrLevel, number>,
    );
    const byKind = REVIEWABLE_KINDS.reduce(
      (acc, k) => ({ ...acc, [k]: 0 }),
      {} as Record<string, number>,
    );
    let reviews = 0;
    let correct = 0;
    let dueForReview = 0;
    for (const it of items) {
      if (it.cefrLevel) byLevel[it.cefrLevel] += 1;
      if (it.englishKind) byKind[it.englishKind] += 1;
      reviews += it.reviewCount ?? 0;
      correct += it.correctCount ?? 0;
      if (!it.lastReviewedAt) dueForReview += 1;
    }

    // New journal entries per day for the last 7 days (oldest → newest).
    const weekly: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      weekly.push({
        date: day.toISOString().slice(0, 10),
        count: journals.filter(
          (j) => j.createdAt >= day && j.createdAt < next,
        ).length,
      });
    }

    return {
      journalCount: journals.length,
      itemCount: items.length,
      byLevel,
      byKind,
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
      englishKind: entry.englishKind ?? null,
      tags: entry.tags ?? [],
      projectId: entry.projectId ?? null,
    });
  }
}
