import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AiService, ExtractedItem, LanguageReview } from '../ai/ai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import {
  EnglishKind,
  Knowledge,
  KnowledgeType,
  REVIEWABLE_KINDS,
} from '../knowledge/entities/knowledge.entity';
import { Task } from '../task/entities/task.entity';

/** What produced a batch of review cards. */
export type CollectedSourceKind = 'ENTRY' | 'TASK';

/** Just enough of the source row to link back to it from the English pages. */
export interface CollectedSource {
  id: string;
  title: string;
  kind: CollectedSourceKind;
  createdAt: Date;
}

/** Review cards grouped by the entry or task they were collected from. */
export interface CollectedFromSource {
  source: CollectedSource;
  items: Knowledge[];
}

/**
 * The English-coaching half of the app, shared by every feature that lets the
 * author write prose: it asks the AI what they should revise, files the result
 * as review cards, and cleans those cards up when the thing they came from is
 * deleted. Knowledge entries and tasks both go through here so the dedupe rules
 * (and the review queue) stay identical for both.
 */
@Injectable()
export class EnglishCoachService {
  private readonly logger = new Logger(EnglishCoachService.name);

  constructor(
    @InjectRepository(Knowledge)
    private readonly repo: Repository<Knowledge>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly ai: AiService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * Read what the author actually typed and collect the English worth revising,
   * plus their title in correct English. Never throws — a coaching failure must
   * not fail the save it runs alongside.
   */
  review(title: string, content: string): Promise<LanguageReview> {
    return this.ai.reviewEnglishUsage(title, content);
  }

  /** Store one extracted item as a reviewable ENGLISH row, and index it. */
  async saveItem(
    it: ExtractedItem,
    sourceId: string,
    projectId: string | null = null,
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
    await this.embed(item);
    return item;
  }

  /**
   * File the English the AI collected from a piece of writing as review cards
   * linked back to it, so they surface in the English review queue. They stay
   * unfiled (`projectId: null`) — study cards would otherwise clutter the
   * project the entry belongs to.
   *
   * An item already collected for this same source is skipped; one already
   * collected elsewhere is re-flagged as hard instead of duplicated, since
   * making the same mistake twice means more review, not two cards.
   *
   * Best-effort: the caller's row is already saved by this point, so a failure
   * here is logged rather than turned into a failed save.
   */
  async collect(
    items: ExtractedItem[],
    sourceId: string,
    projectId: string | null = null,
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
          if (existing.sourceId !== sourceId && !existing.hard) {
            existing.hard = true;
            await this.repo.save(existing);
          }
          continue;
        }
        created.push(await this.saveItem(it, sourceId, projectId));
      } catch (e) {
        this.logger.error(
          `collect(): could not store "${it.front}" from ${sourceId}: ${e.message}`,
        );
      }
    }
    return created;
  }

  /** The cards collected from one entry or task, oldest first. */
  collectedFor(sourceId: string): Promise<Knowledge[]> {
    return this.repo.find({
      where: {
        sourceId,
        type: KnowledgeType.ENGLISH,
        englishKind: In(REVIEWABLE_KINDS),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Drop every card collected from a source (its entry or task is being
   * deleted, or is about to be re-coached). Returns the removed rows so the
   * caller can clean up anything else attached to them.
   */
  async removeCollected(sourceId: string): Promise<Knowledge[]> {
    const items = await this.repo.find({ where: { sourceId } });
    for (const item of items) {
      const itemId = item.id; // repo.remove() clears the id off the entity
      await this.repo.remove(item);
      await this.embedding.remove(itemId);
    }
    return items;
  }

  /**
   * Cards collected from ordinary writing (knowledge entries and tasks — not
   * from English journal entries), newest first, grouped by what they came from.
   */
  async collectedBySource(limit = 20): Promise<CollectedFromSource[]> {
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

    const sourceIds = [...new Set(items.map((it) => it.sourceId!))];
    const [entries, tasks] = await Promise.all([
      this.repo.find({ where: { id: In(sourceIds) } }),
      this.taskRepo.find({ where: { id: In(sourceIds) } }),
    ]);

    const bySourceId = new Map<string, CollectedSource>();
    for (const e of entries) {
      // Journal-sourced items belong to the diary timeline, not here.
      if (e.type === KnowledgeType.ENGLISH) continue;
      bySourceId.set(e.id, {
        id: e.id,
        title: e.title,
        kind: 'ENTRY',
        createdAt: e.createdAt,
      });
    }
    for (const t of tasks) {
      bySourceId.set(t.id, {
        id: t.id,
        title: t.title,
        kind: 'TASK',
        createdAt: t.createdAt,
      });
    }

    const groups: CollectedFromSource[] = [];
    const byId = new Map<string, CollectedFromSource>();
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

  /** Index a review card so it is searchable alongside everything else. */
  private async embed(item: Knowledge): Promise<void> {
    await this.embedding.upsert(item.id, `${item.title}\n\n${item.content}`, {
      title: item.title,
      summary: item.summary ?? '',
      type: item.type,
      englishKind: item.englishKind ?? null,
      tags: item.tags ?? [],
      projectId: item.projectId ?? null,
    });
  }
}

/** Re-exported so callers don't need to reach into the AI module. */
export type { ExtractedItem, LanguageReview };
