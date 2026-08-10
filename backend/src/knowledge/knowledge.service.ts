import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AiService, ExtractedItem, LanguageReview } from '../ai/ai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { StorageService } from '../storage/storage.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import {
  CefrLevel,
  EnglishKind,
  ImageRef,
  Knowledge,
  KnowledgeType,
  REVIEWABLE_KINDS,
} from './entities/knowledge.entity';

/** A journal diary entry together with the items the AI extracted from it. */
export interface JournalWithItems {
  journal: Knowledge;
  items: Knowledge[];
}

/** An ordinary entry together with the English items collected while saving it. */
export interface CollectedFromEntry {
  source: Knowledge;
  items: Knowledge[];
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(Knowledge)
    private readonly repo: Repository<Knowledge>,
    private readonly ai: AiService,
    private readonly embedding: EmbeddingService,
    private readonly storage: StorageService,
  ) {}

  /** Run AI enrichment then persist + embed. */
  async create(dto: CreateKnowledgeDto): Promise<Knowledge> {
    const type = dto.type ?? KnowledgeType.INSIGHT;

    // ENGLISH entries are free-form journal entries: extract + store review items.
    if (type === KnowledgeType.ENGLISH) {
      const { journal } = await this.ingestEnglishJournal(
        dto.content,
        dto.projectId ?? null,
        dto.images ?? [],
      );
      return journal;
    }

    // Clean the body up into structured English Markdown before it is
    // stored/embedded, and — from the same raw text — collect the English the
    // author still needs to learn. Two independent calls, so run them together.
    const [content, review] = await Promise.all([
      this.formatIfRequested(dto.content, dto.title, type, dto.autoFormat),
      this.reviewIfRequested(dto.content, dto.title, type, dto.autoFormat),
    ]);
    const title = review?.title || dto.title;

    const enrichment = await this.ai.enrich(title, content);
    const entity = this.repo.create({
      title,
      content,
      // Only worth keeping when the AI actually rewrote what was typed.
      originalContent: content === dto.content ? null : dto.content,
      type,
      projectId: dto.projectId ?? null,
      // Honour user-supplied tags, otherwise use the AI's.
      tags: dto.tags?.length ? dto.tags : enrichment.tags,
      summary: enrichment.summary,
      codeSnippets: enrichment.codeSnippets,
      images: dto.images ?? [],
    });

    const saved = await this.repo.save(entity);
    await this.embedToQdrant(saved);
    await this.collectEnglishItems(review?.items ?? [], saved);
    return saved;
  }

  /**
   * AI-reformat an entry body into English unless the caller opted out. ENGLISH
   * entries are free-form diary text and are always kept verbatim (the journal
   * extraction reads the user's own wording).
   */
  private async formatIfRequested(
    content: string,
    title: string,
    type: KnowledgeType,
    autoFormat?: boolean,
  ): Promise<string> {
    if (autoFormat === false || type === KnowledgeType.ENGLISH) return content;
    return this.ai.formatContent(content, title, type);
  }

  /**
   * Mine the raw text for English worth revising, on the same terms as the
   * reformat: opting out of the AI rewrite opts out of the coaching too, and
   * ENGLISH journals already have their own extraction.
   */
  private async reviewIfRequested(
    content: string,
    title: string,
    type: KnowledgeType,
    autoFormat?: boolean,
  ): Promise<LanguageReview | null> {
    if (autoFormat === false || type === KnowledgeType.ENGLISH) return null;
    return this.ai.reviewEnglishUsage(title, content);
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

    const type = dto.type ?? entry.type;
    const rawContent = dto.content;
    const contentChanged =
      rawContent !== undefined && rawContent !== entry.content;
    const titleChanged = !!dto.title && dto.title !== entry.title;

    // Reformat the incoming body first, so enrichment + embedding see the
    // cleaned-up text and the change detection below compares like with like.
    // An unchanged body is left alone: it was already formatted on the way in,
    // and re-running costs the user a slow save for an identical result. The
    // coaching pass reads whichever text is newest — a title edit alone still
    // needs translating.
    const [formatted, review] = await Promise.all([
      contentChanged
        ? this.formatIfRequested(
            rawContent!,
            dto.title ?? entry.title,
            type,
            dto.autoFormat,
          )
        : Promise.resolve<string | undefined>(undefined),
      contentChanged || titleChanged
        ? this.reviewIfRequested(
            rawContent ?? entry.content,
            dto.title ?? entry.title,
            type,
            dto.autoFormat,
          )
        : Promise.resolve<LanguageReview | null>(null),
    ]);

    const content = contentChanged ? formatted : dto.content;
    const titleOrContentChanged =
      titleChanged || (!!content && content !== entry.content);

    if (contentChanged) {
      entry.originalContent = content === rawContent ? null : rawContent!;
    }

    Object.assign(entry, {
      // Only take the AI's English title when the user actually touched the
      // title — otherwise an edit elsewhere would keep re-wording it.
      title: (titleChanged && review?.title) || dto.title || entry.title,
      content: content ?? entry.content,
      type,
      tags: dto.tags ?? entry.tags,
      // undefined → leave as-is; null → unfile from its project.
      projectId: dto.projectId === undefined ? entry.projectId : dto.projectId,
      images: dto.images ?? entry.images,
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
    await this.collectEnglishItems(review?.items ?? [], saved);
    return saved;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const entry = await this.findOne(id);
    const imageKeys = (entry.images ?? []).map((img) => img.key);

    // Deleting an entry also removes whatever the AI pulled out of it: a
    // journal's review items, or the English notes collected while translating.
    const items = await this.repo.find({ where: { sourceId: id } });
    for (const item of items) {
      const itemId = item.id; // repo.remove() clears the id off the entity
      imageKeys.push(...(item.images ?? []).map((img) => img.key));
      await this.repo.remove(item);
      await this.embedding.remove(itemId);
    }

    await this.repo.remove(entry);
    await this.embedding.remove(id);
    // Best-effort cleanup of the entry's images in R2.
    await this.storage.deleteMany(imageKeys);
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
    images: ImageRef[] = [],
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
        images,
      }),
    );
    await this.embedToQdrant(journal);

    const items: Knowledge[] = [];
    for (const it of extraction.items) {
      items.push(await this.saveEnglishItem(it, journal.id, projectId));
    }

    return { journal, items };
  }

  /** Store one extracted item as a reviewable ENGLISH row, and index it. */
  private async saveEnglishItem(
    it: ExtractedItem,
    sourceId: string,
    projectId: string | null,
  ): Promise<Knowledge> {
    const item = await this.repo.save(
      this.repo.create({
        title: it.front.length > 80 ? `${it.front.slice(0, 77)}…` : it.front,
        content: it.front,
        type: KnowledgeType.ENGLISH,
        englishKind: it.kind,
        summary: it.meaning,
        cefrLevel: it.cefrLevel,
        hard: it.hard,
        sourceId,
        tags: [],
        projectId,
      }),
    );
    await this.embedToQdrant(item);
    return item;
  }

  /**
   * File the English the AI collected from an ordinary entry as review cards
   * linked back to that entry, so they surface in the English review queue.
   * They stay unfiled (`projectId: null`) — study cards would otherwise clutter
   * the project the entry belongs to.
   *
   * An item already collected for this same entry is skipped; one already
   * collected elsewhere is re-flagged as hard instead of duplicated, since
   * making the same mistake twice means more review, not two cards.
   *
   * Best-effort: the entry is already saved by this point, so a failure here is
   * logged rather than turned into a failed save.
   */
  private async collectEnglishItems(
    items: ExtractedItem[],
    source: Knowledge,
  ): Promise<Knowledge[]> {
    const created: Knowledge[] = [];
    for (const it of items) {
      try {
        const existing = await this.repo.findOne({
          where: {
            type: KnowledgeType.ENGLISH,
            englishKind: In(REVIEWABLE_KINDS),
            content: it.front,
          },
        });
        if (existing) {
          if (existing.sourceId !== source.id && !existing.hard) {
            existing.hard = true;
            await this.repo.save(existing);
          }
          continue;
        }
        created.push(await this.saveEnglishItem(it, source.id, null));
      } catch (e) {
        this.logger.error(
          `collectEnglishItems(): could not store "${it.front}" from entry ` +
            `${source.id}: ${e.message}`,
        );
      }
    }
    return created;
  }

  /**
   * The other half of the English journey: items collected from ordinary
   * knowledge entries (not from journal entries), newest first, grouped by the
   * entry they came from.
   */
  async englishCollected(limit = 20): Promise<CollectedFromEntry[]> {
    const items = await this.repo.find({
      where: {
        type: KnowledgeType.ENGLISH,
        englishKind: In(REVIEWABLE_KINDS),
        sourceId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    if (!items.length) return [];

    const sources = await this.repo.find({
      where: { id: In([...new Set(items.map((it) => it.sourceId!))]) },
    });
    // Journal-sourced items belong to the timeline, not here.
    const bySourceId = new Map(
      sources
        .filter((s) => s.type !== KnowledgeType.ENGLISH)
        .map((s) => [s.id, s]),
    );

    const groups: CollectedFromEntry[] = [];
    const byId = new Map<string, CollectedFromEntry>();
    for (const item of items) {
      const source = bySourceId.get(item.sourceId!);
      if (!source) continue;
      let group = byId.get(source.id);
      if (!group) {
        group = { source, items: [] };
        byId.set(source.id, group);
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
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
