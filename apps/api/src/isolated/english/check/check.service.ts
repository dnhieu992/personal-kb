import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AiGateway } from '../../../platform/ai/ai.gateway';

/** One fix the learner can accept or skip. */
export interface EnglishChange {
  original: string;
  replacement: string;
  /** vietnamese = a Vietnamese word/phrase put into English. */
  kind: 'grammar' | 'vocab' | 'vietnamese' | 'spelling' | 'style';
  note: string;
}

/** A word or point worth a review card. */
export interface EnglishCard {
  front: string;
  meaning: string;
  kind: 'VOCAB' | 'MISTAKE' | 'GRAMMAR';
  example: string;
}

export interface EnglishCheck {
  corrected: string;
  changes: EnglishChange[];
  cards: EnglishCard[];
}

const str = { type: 'string' } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const SCHEMA = obj({
  corrected: str,
  changes: {
    type: 'array',
    items: obj({
      original: str,
      replacement: str,
      kind: { type: 'string', enum: ['grammar', 'vocab', 'vietnamese', 'spelling', 'style'] },
      note: str,
    }),
  },
  cards: {
    type: 'array',
    items: obj({
      front: str,
      meaning: str,
      kind: { type: 'string', enum: ['VOCAB', 'MISTAKE', 'GRAMMAR'] },
      example: str,
    }),
  },
});

/** Accuracy matters more than speed here, and a note is short: a mid-size model. */
const MODEL = 'claude-sonnet-5-5';

/**
 * Proofreads a technical note written in English by a Vietnamese engineer —
 * grammar, word choice, and the Vietnamese words they dropped in when they
 * didn't know the English — and suggests review cards for what they didn't know.
 *
 * Code, links and images must come back byte-for-byte, so they are swapped for
 * placeholders before the model sees the text and restored afterwards.
 */
@Injectable()
export class CheckService {
  private readonly logger = new Logger(CheckService.name);

  constructor(private readonly ai: AiGateway) {}

  async check(content: string): Promise<EnglishCheck> {
    this.ai.assertEnabled();
    const { text, restore, restoreAll } = protect(content);
    const system =
      'You proofread technical notes written in English by a Vietnamese software engineer who is learning ' +
      'English (around CEFR B1). Text inside ⟦…⟧ is code, a link or an image: copy every ⟦…⟧ token exactly, ' +
      'never change, move or drop one. Keep the Markdown structure (headings, lists, checkboxes, tables, ' +
      'line breaks) exactly as written.\n\n' +
      'Fix:\n' +
      '- grammar and spelling mistakes;\n' +
      '- unnatural or wrong word choices (prefer the words engineers really use);\n' +
      '- Vietnamese words or phrases mixed into the English (the writer did not know the English word): ' +
      'replace them with the natural English term; a whole Vietnamese sentence becomes an English sentence.\n' +
      'Do NOT rewrite for style when the sentence is already correct and clear; keep the writer\'s voice, ' +
      'technical terms, product names and identifiers. Small, targeted edits only.\n\n' +
      'Return:\n' +
      '- corrected: the whole note with all fixes applied (same ⟦…⟧ tokens, same structure).\n' +
      '- changes: one item per edit, in reading order. original = the exact text as it appears in the note ' +
      '(long enough to be unique, at most one sentence), replacement = what it becomes, kind, ' +
      'note = one short Vietnamese sentence explaining why (for a Vietnamese word: its English meaning). ' +
      'No change for untouched text.\n' +
      '- cards: review flashcards for what the writer did not know: every Vietnamese word/phrase you put into ' +
      'English (kind VOCAB, front = the English word or phrase, meaning = the Vietnamese they wrote + a short ' +
      'note), wrong word choices worth remembering (VOCAB or MISTAKE: front = the right expression, meaning = ' +
      'Vietnamese explanation incl. the wrong form), and repeated grammar mistakes (GRAMMAR: front = the rule in ' +
      'a few English words, meaning = Vietnamese explanation). example = one English sentence from the note ' +
      'using it. Skip trivial typos. At most 15 cards.\n' +
      'If the note has no mistakes, return it unchanged with empty lists.';
    const { data } = await this.ai.ask<EnglishCheck>({
      module: 'english',
      purpose: 'check-english',
      model: MODEL,
      system,
      user: text,
      schema: SCHEMA,
      effort: 'medium',
      timeoutMs: 3 * 60_000,
    });
    if (!data?.corrected) throw new ServiceUnavailableException('The AI returned no result — please try again.');

    const corrected = restoreAll(data.corrected);
    if (corrected === null) {
      // The model dropped or altered a protected token: don't risk mangling code.
      this.logger.warn('english check: protected token lost, falling back to per-change edits');
    }
    const changes = (data.changes ?? [])
      .map((c) => ({ ...c, original: restore(c.original) ?? c.original, replacement: restore(c.replacement) ?? c.replacement }))
      .filter((c) => c.original && c.original !== c.replacement && content.includes(c.original));
    return {
      corrected: corrected ?? applyChanges(content, changes),
      changes,
      cards: (data.cards ?? []).filter((c) => c.front && c.meaning).slice(0, 15),
    };
  }
}

/** Apply edits one by one (first occurrence each); edits that no longer match are skipped. */
export function applyChanges(content: string, changes: Pick<EnglishChange, 'original' | 'replacement'>[]): string {
  let out = content;
  for (const c of changes) {
    const at = out.indexOf(c.original);
    if (at >= 0) out = out.slice(0, at) + c.replacement + out.slice(at + c.original.length);
  }
  return out;
}

/**
 * Swap fenced code, inline code, images, links' URLs and bare URLs for ⟦n⟧.
 * `restore` puts them back, or returns null when a token went missing.
 */
function protect(content: string) {
  const kept: string[] = [];
  const hold = (s: string) => {
    kept.push(s);
    return `⟦${kept.length}⟧`;
  };
  const text = content
    .replace(/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/g, (m, lead) => lead + hold(m.slice(lead.length)))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, hold)
    .replace(/`[^`\n]+`/g, hold)
    .replace(/\]\(([^)]+)\)/g, (_m, url) => `](${hold(url)})`)
    .replace(/https?:\/\/[^\s)⟧]+/g, hold);
  const restore = (s: string): string | null => {
    const out = s.replace(/⟦(\d+)⟧/g, (m, n) => kept[Number(n) - 1] ?? m);
    return /⟦\d+⟧/.test(out) ? null : out;
  };
  /** For the whole note: every token must come back exactly once, or code was lost. */
  const restoreAll = (s: string): string | null =>
    kept.every((_, i) => s.split(`⟦${i + 1}⟧`).length === 2) ? restore(s) : null;
  return { text, restore, restoreAll };
}
