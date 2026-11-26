import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CreateJournalInput, RecordMistakesInput, RecordMistakesResult, UpdateCardInput } from '@pkb/contracts';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AiGateway, FAST_MODEL } from '../../../platform/ai/ai.gateway';
import { newId } from '../../../platform/database/ids';
import { CefrLevel, EnglishKind, REVIEWABLE_KINDS } from '../shared/cefr';
import { EnglishCorrectionEntity } from '../correction/english-correction.entity';
import { EnglishCardEntity } from './english-card.entity';
import { EnglishJournalEntity, ImageRef } from './english-journal.entity';

/** One reviewable item the AI pulls out of some writing. */
export interface ExtractedItem {
  kind: EnglishKind;
  front: string;
  meaning: string;
  cefrLevel: CefrLevel;
  hard: boolean;
}

/** Where a batch of cards came from — free text, never a foreign key into core. */
export interface CardSource {
  journalId?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
}

/**
 * The v1 `Knowledge` shape the ported English pages read. Kept so the port changes
 * storage, not the UI: cards → englishKind SENTENCE/GRAMMAR/MISTAKE/VOCAB, journals → JOURNAL.
 */
export interface LegacyEnglishItem {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  type: 'ENGLISH';
  englishKind: EnglishKind;
  cefrLevel: CefrLevel | null;
  hard: boolean;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: Date | null;
  sourceId: string | null;
  source: string | null;
  sourceUrl: string | null;
  tags: string[];
  images: ImageRef[];
  projectId: null;
  createdAt: Date;
  updatedAt: Date;
}

const JOURNAL_SYSTEM =
  'You are an English-learning journal assistant. The user writes a free-form ' +
  'diary entry about what they studied today (often in Vietnamese, quoting ' +
  'English sentences/words). Respond with ONLY a JSON object (no prose, no ' +
  'markdown fences) of the shape: ' +
  '{"summary": string, "items": [{"kind": "SENTENCE"|"GRAMMAR"|"MISTAKE"|"VOCAB", ' +
  '"front": string, "meaning": string, "cefrLevel": "A1"|"A2"|"B1"|"B2"|"C1"|"C2", ' +
  '"hard": boolean}]}. ' +
  "summary: 1-2 sentences capturing what was learned (in the user's language). " +
  'items: every English sentence, phrase, word, grammar point, or recurring ' +
  'mistake worth reviewing. front = the English item itself (for MISTAKE, the ' +
  'wrong usage). meaning = a clear explanation/translation (for MISTAKE, the ' +
  'correction and why). cefrLevel = its difficulty. hard = true when the user ' +
  'signals difficulty (e.g. "khó nhớ", "phải tra từ điển", "gặp lần thứ 3"). ' +
  'If there is nothing concrete to review, return an empty items array.';

@Injectable()
export class CardService {
  private readonly logger = new Logger('EnglishCards');

  constructor(
    @InjectRepository(EnglishCardEntity) private readonly cards: Repository<EnglishCardEntity>,
    @InjectRepository(EnglishJournalEntity) private readonly journals: Repository<EnglishJournalEntity>,
    @InjectRepository(EnglishCorrectionEntity) private readonly corrections: Repository<EnglishCorrectionEntity>,
    private readonly ai: AiGateway,
  ) {}

  // ---------- coaching: file items as cards ----------

  /**
   * File items as review cards. An item already filed from the same source is skipped;
   * one filed from elsewhere is re-flagged hard instead of duplicated (same mistake twice
   * = more review, not two cards). Best-effort per item.
   */
  async collect(items: ExtractedItem[], src: CardSource): Promise<EnglishCardEntity[]> {
    const created: EnglishCardEntity[] = [];
    for (const it of items) {
      try {
        const existing = await this.cards.findOne({ where: { front: it.front } });
        if (existing) {
          const sameSource =
            (src.journalId && existing.journalId === src.journalId) || (!!src.source && existing.source === src.source);
          if (!sameSource && !existing.hard) {
            existing.hard = true;
            await this.cards.save(existing);
          }
          continue;
        }
        created.push(await this.saveItem(it, src));
      } catch (e) {
        this.logger.error(`collect(): could not store "${it.front}": ${e.message}`);
      }
    }
    return created;
  }

  private async saveItem(it: ExtractedItem, src: CardSource): Promise<EnglishCardEntity> {
    const card = this.cards.create({
      id: newId(),
      kind: it.kind,
      title: it.front.length > 80 ? `${it.front.slice(0, 77)}…` : it.front,
      front: it.front,
      meaning: it.meaning,
      cefrLevel: it.cefrLevel,
      hard: it.hard,
      reviewCount: 0,
      correctCount: 0,
      lastReviewedAt: null,
      journalId: src.journalId ?? null,
      source: src.source?.slice(0, 300) ?? null,
      sourceUrl: src.sourceUrl?.slice(0, 500) ?? null,
    });
    await this.cards.insert(card);
    return card;
  }

  /** Accepted Check-English fixes + chosen cards → review queue (POST /english/mistakes). */
  async recordMistakes(input: RecordMistakesInput): Promise<RecordMistakesResult> {
    const src: CardSource = { source: input.source ?? 'Check English', sourceUrl: input.sourceUrl ?? null };
    for (const c of input.changes) {
      await this.corrections.insert({
        id: newId(),
        kind: c.kind,
        original: c.original,
        corrected: c.replacement,
        why: c.note,
        source: src.source ?? null,
      });
    }
    const items: ExtractedItem[] = [
      // Each accepted grammar/vocab/Vietnamese fix is a MISTAKE card (spelling/style are not worth a card).
      ...input.changes
        .filter((c) => c.kind !== 'spelling' && c.kind !== 'style')
        .map((c) => ({
          kind: c.kind === 'grammar' ? EnglishKind.MISTAKE : EnglishKind.VOCAB,
          front: c.kind === 'grammar' ? c.original : c.replacement,
          meaning: c.kind === 'grammar' ? `${c.replacement} — ${c.note}` : `${c.original} → ${c.replacement} — ${c.note}`,
          cefrLevel: CefrLevel.B1,
          hard: false,
        })),
      ...input.cards.map((c) => ({
        kind: (EnglishKind as Record<string, EnglishKind>)[c.kind] ?? EnglishKind.VOCAB,
        front: c.front,
        meaning: c.example ? `${c.meaning} — ${c.example}` : c.meaning,
        cefrLevel: CefrLevel.B1,
        hard: false,
      })),
    ];
    const saved = await this.collect(items, src);
    return { saved: saved.length, skipped: items.length - saved.length };
  }

  // ---------- journal ----------

  async ingestJournal(input: CreateJournalInput): Promise<{ journal: LegacyEnglishItem; items: LegacyEnglishItem[] }> {
    const text = input.text;
    const extraction = await this.extractJournal(text);
    const journal = this.journals.create({
      id: newId(),
      title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
      content: text,
      summary: extraction.summary,
      images: input.images as ImageRef[],
    });
    await this.journals.insert(journal);
    const items: EnglishCardEntity[] = [];
    for (const it of extraction.items) items.push(await this.saveItem(it, { journalId: journal.id }));
    return { journal: journalToLegacy(journal), items: items.map(cardToLegacy) };
  }

  async journalTimeline(): Promise<{ journal: LegacyEnglishItem; items: LegacyEnglishItem[] }[]> {
    const journals = await this.journals.find({ order: { createdAt: 'DESC' } });
    if (!journals.length) return [];
    const items = await this.cards.find({ where: { journalId: In(journals.map((j) => j.id)) }, order: { createdAt: 'ASC' } });
    const by = new Map<string, EnglishCardEntity[]>();
    for (const i of items) by.set(i.journalId!, [...(by.get(i.journalId!) ?? []), i]);
    return journals.map((j) => ({ journal: journalToLegacy(j), items: (by.get(j.id) ?? []).map(cardToLegacy) }));
  }

  async removeJournal(id: string): Promise<{ deleted: boolean }> {
    const j = await this.journals.findOneBy({ id });
    if (!j) throw new NotFoundException('Journal entry not found');
    await this.cards.delete({ journalId: id });
    await this.journals.delete(id);
    return { deleted: true };
  }

  /** Cards collected from writing outside the journal (Check English etc.), grouped by source. */
  async collectedBySource(limit = 20) {
    const items = await this.cards.find({
      where: { journalId: IsNull(), source: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    const groups: { source: { id: string; title: string; kind: 'NOTE' | 'TASK' | 'OTHER'; href: string | null; createdAt: Date }; items: LegacyEnglishItem[] }[] = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const it of items) {
      const key = `${it.source}|${it.sourceUrl ?? ''}`;
      let g = byKey.get(key);
      if (!g) {
        const kind = it.sourceUrl?.includes('task=') ? 'TASK' : it.sourceUrl?.startsWith('/notes/') ? 'NOTE' : 'OTHER';
        g = { source: { id: key, title: it.source!, kind, href: it.sourceUrl, createdAt: it.createdAt }, items: [] };
        byKey.set(key, g);
        groups.push(g);
      }
      g.items.push(cardToLegacy(it));
    }
    return groups;
  }

  // ---------- review ----------

  /** Hard first, then never-reviewed, then least recently seen. */
  async reviewQueue(limit = 20): Promise<LegacyEnglishItem[]> {
    const rows = await this.cards
      .createQueryBuilder('c')
      .orderBy('c.hard', 'DESC')
      .addOrderBy('c.lastReviewedAt IS NULL', 'DESC')
      .addOrderBy('c.lastReviewedAt', 'ASC')
      .addOrderBy('c.createdAt', 'ASC')
      .take(limit)
      .getMany();
    return rows.map(cardToLegacy);
  }

  async recordReview(id: string, remembered: boolean): Promise<LegacyEnglishItem> {
    const c = await this.card(id);
    c.reviewCount += 1;
    if (remembered) {
      c.correctCount += 1;
      c.hard = false;
    }
    c.lastReviewedAt = new Date();
    await this.cards.save(c);
    return cardToLegacy(c);
  }

  async stats() {
    const [items, journals] = await Promise.all([this.cards.find(), this.journals.find({ select: ['id', 'createdAt'] })]);
    const byLevel = Object.values(CefrLevel).reduce((a, l) => ({ ...a, [l]: 0 }), {} as Record<CefrLevel, number>);
    const byKind = REVIEWABLE_KINDS.reduce((a, k) => ({ ...a, [k]: 0 }), {} as Record<string, number>);
    let reviews = 0;
    let correct = 0;
    let dueForReview = 0;
    for (const it of items) {
      if (it.cefrLevel) byLevel[it.cefrLevel] += 1;
      byKind[it.kind] = (byKind[it.kind] ?? 0) + 1;
      reviews += it.reviewCount;
      correct += it.correctCount;
      if (!it.lastReviewedAt) dueForReview += 1;
    }
    const weekly: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      weekly.push({ date: day.toISOString().slice(0, 10), count: journals.filter((j) => j.createdAt >= day && j.createdAt < next).length });
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

  // ---------- card CRUD ----------

  async get(id: string): Promise<LegacyEnglishItem> {
    const card = await this.cards.findOneBy({ id });
    if (card) return cardToLegacy(card);
    const j = await this.journals.findOneBy({ id });
    if (j) return journalToLegacy(j);
    throw new NotFoundException('English item not found');
  }

  async update(id: string, input: UpdateCardInput): Promise<LegacyEnglishItem> {
    const c = await this.card(id);
    if (input.title !== undefined) c.title = input.title;
    if (input.content !== undefined) c.front = input.content;
    if (input.summary !== undefined) c.meaning = input.summary;
    if (input.cefrLevel !== undefined) c.cefrLevel = input.cefrLevel as CefrLevel | null;
    if (input.hard !== undefined) c.hard = input.hard;
    await this.cards.save(c);
    return cardToLegacy(c);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (await this.journals.findOneBy({ id })) return this.removeJournal(id);
    await this.card(id);
    await this.cards.delete(id);
    return { deleted: true };
  }

  listCorrections(limit = 100) {
    return this.corrections.find({ order: { createdAt: 'DESC' }, take: Math.min(500, limit) });
  }

  private async card(id: string) {
    const c = await this.cards.findOneBy({ id });
    if (!c) throw new NotFoundException('Card not found');
    return c;
  }

  // ---------- AI ----------

  private async extractJournal(text: string): Promise<{ summary: string; items: ExtractedItem[] }> {
    const fallback = { summary: text.split('\n')[0]?.slice(0, 140) ?? text, items: [] };
    if (!this.ai.isEnabled() || !text.trim()) return fallback;
    try {
      const r = await this.ai.ask({ module: 'english', purpose: 'journal.extract', model: FAST_MODEL, system: JOURNAL_SYSTEM, user: text });
      const parsed = AiGateway.parseJson<{ summary?: string; items?: Partial<ExtractedItem>[] }>(r.text);
      return {
        summary: parsed.summary?.trim() || text.slice(0, 140),
        items: (parsed.items ?? []).map(normaliseItem).filter((x): x is ExtractedItem => !!x),
      };
    } catch (e) {
      this.logger.error(`journal extraction failed: ${e.message}`);
      return fallback;
    }
  }
}

export function normaliseItem(raw: Partial<ExtractedItem>): ExtractedItem | null {
  const front = raw.front?.toString().trim();
  if (!front) return null;
  const kind = (raw.kind ?? '').toString().toUpperCase();
  const level = (raw.cefrLevel ?? '').toString().toUpperCase();
  const k = (EnglishKind as Record<string, EnglishKind>)[kind];
  return {
    kind: k && k !== EnglishKind.JOURNAL ? k : EnglishKind.SENTENCE,
    front,
    meaning: raw.meaning?.toString().trim() || front,
    cefrLevel: (CefrLevel as Record<string, CefrLevel>)[level] ?? CefrLevel.B1,
    hard: !!raw.hard,
  };
}

export function cardToLegacy(c: EnglishCardEntity): LegacyEnglishItem {
  return {
    id: c.id,
    title: c.title,
    content: c.front,
    summary: c.meaning,
    type: 'ENGLISH',
    englishKind: c.kind,
    cefrLevel: c.cefrLevel,
    hard: !!c.hard,
    reviewCount: c.reviewCount,
    correctCount: c.correctCount,
    lastReviewedAt: c.lastReviewedAt,
    sourceId: c.journalId,
    source: c.source,
    sourceUrl: c.sourceUrl,
    tags: [],
    images: [],
    projectId: null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function journalToLegacy(j: EnglishJournalEntity): LegacyEnglishItem {
  return {
    id: j.id,
    title: j.title,
    content: j.content,
    summary: j.summary,
    type: 'ENGLISH',
    englishKind: EnglishKind.JOURNAL,
    cefrLevel: null,
    hard: false,
    reviewCount: 0,
    correctCount: 0,
    lastReviewedAt: null,
    sourceId: null,
    source: null,
    sourceUrl: null,
    tags: [],
    images: j.images ?? [],
    projectId: null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}
