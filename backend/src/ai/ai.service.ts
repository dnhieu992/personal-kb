import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { CefrLevel, EnglishKind } from '../knowledge/entities/knowledge.entity';

// claude-haiku-3-5 (requested in the brief) is retired and 404s; use current Haiku.
const MODEL = 'claude-haiku-4-5';

export interface Enrichment {
  tags: string[];
  summary: string;
  codeSnippets: string[];
}

/** One reviewable item the AI pulls out of a free-form journal entry. */
export interface ExtractedItem {
  kind: EnglishKind; // SENTENCE | GRAMMAR | MISTAKE | VOCAB
  front: string; // the sentence / word / grammar point / wrong usage
  meaning: string; // translation, explanation, or the correction
  cefrLevel: CefrLevel;
  hard: boolean; // user signalled this is hard to remember
}

export interface JournalExtraction {
  summary: string;
  items: ExtractedItem[];
}

export interface RagSource {
  title: string;
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.enabled = !!apiKey;
    this.client = new Anthropic({ apiKey: apiKey ?? 'missing' });
    if (!this.enabled) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI features will return fallbacks.',
      );
    }
  }

  private firstText(message: Anthropic.Message): string {
    const block = message.content.find((b) => b.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }

  /** Parse JSON from a model reply, tolerating ```json fences. */
  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }

  /**
   * One Claude call that auto-extracts tags, generates a one-line summary, and
   * pulls out code snippets. Uses structured outputs so the result is valid JSON.
   */
  async enrich(title: string, content: string): Promise<Enrichment> {
    if (!this.enabled) {
      return { tags: [], summary: title, codeSnippets: [] };
    }
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system:
          'You analyse engineering knowledge-base entries. Respond with ONLY a ' +
          'JSON object (no prose, no markdown fences) of the shape: ' +
          '{"tags": string[], "summary": string, "codeSnippets": string[]}. ' +
          'tags: max 6 concise lowercase hyphenated topics. ' +
          'summary: a single sentence. ' +
          'codeSnippets: each distinct code block present in the content, verbatim.',
        messages: [
          {
            role: 'user',
            content: `Title: ${title}\n\nContent:\n${content}`,
          },
        ],
      });
      const parsed = this.parseJson<Enrichment>(this.firstText(response));
      return {
        tags: parsed.tags ?? [],
        summary: parsed.summary ?? title,
        codeSnippets: parsed.codeSnippets ?? [],
      };
    } catch (e) {
      this.logger.error(`enrich() failed: ${e.message}`);
      return { tags: [], summary: title, codeSnippets: [] };
    }
  }

  /** Suggest tags only (used by the frontend when content is pasted). */
  async suggestTags(content: string): Promise<string[]> {
    if (!this.enabled || !content.trim()) return [];
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 256,
        system:
          'Respond with ONLY a JSON object (no prose, no markdown fences) of the ' +
          'shape {"tags": string[]} — up to 6 concise, lowercase, hyphenated ' +
          'topic tags for the given text.',
        messages: [{ role: 'user', content }],
      });
      const parsed = this.parseJson<{ tags: string[] }>(this.firstText(response));
      return parsed.tags ?? [];
    } catch (e) {
      this.logger.error(`suggestTags() failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Read a free-form English-learning journal entry (the user may write in
   * Vietnamese mixed with English) and (1) summarise it, (2) extract the
   * reviewable items worth keeping — sentences, grammar points, common
   * mistakes, vocabulary — grading each and flagging the ones the user found
   * hard to remember. One Claude call, structured JSON, graceful fallback.
   */
  async extractEnglishJournal(text: string): Promise<JournalExtraction> {
    if (!this.enabled || !text.trim()) {
      return { summary: text.split('\n')[0]?.slice(0, 140) ?? text, items: [] };
    }
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system:
          'You are an English-learning journal assistant. The user writes a free-form ' +
          'diary entry about what they studied today (often in Vietnamese, quoting ' +
          'English sentences/words). Respond with ONLY a JSON object (no prose, no ' +
          'markdown fences) of the shape: ' +
          '{"summary": string, "items": [{"kind": "SENTENCE"|"GRAMMAR"|"MISTAKE"|"VOCAB", ' +
          '"front": string, "meaning": string, "cefrLevel": "A1"|"A2"|"B1"|"B2"|"C1"|"C2", ' +
          '"hard": boolean}]}. ' +
          'summary: 1-2 sentences capturing what was learned (in the user\'s language). ' +
          'items: every English sentence, phrase, word, grammar point, or recurring ' +
          'mistake worth reviewing. front = the English item itself (for MISTAKE, the ' +
          'wrong usage). meaning = a clear explanation/translation (for MISTAKE, the ' +
          'correction and why). cefrLevel = its difficulty. hard = true when the user ' +
          'signals difficulty (e.g. "khó nhớ", "phải tra từ điển", "gặp lần thứ 3"). ' +
          'If there is nothing concrete to review, return an empty items array.',
        messages: [{ role: 'user', content: text }],
      });
      const parsed = this.parseJson<JournalExtraction>(this.firstText(response));
      const items = (parsed.items ?? [])
        .map((it) => this.normaliseItem(it))
        .filter((it): it is ExtractedItem => it !== null);
      return {
        summary: parsed.summary?.trim() || text.slice(0, 140),
        items,
      };
    } catch (e) {
      this.logger.error(`extractEnglishJournal() failed: ${e.message}`);
      return { summary: text.split('\n')[0]?.slice(0, 140) ?? text, items: [] };
    }
  }

  /** Coerce one raw extracted item into a valid ExtractedItem, or drop it. */
  private normaliseItem(raw: Partial<ExtractedItem>): ExtractedItem | null {
    const front = raw.front?.toString().trim();
    if (!front) return null;
    const kind = (raw.kind ?? '').toString().toUpperCase();
    const level = (raw.cefrLevel ?? '').toString().toUpperCase();
    return {
      kind: (EnglishKind as Record<string, EnglishKind>)[kind] ?? EnglishKind.SENTENCE,
      front,
      meaning: raw.meaning?.toString().trim() || front,
      cefrLevel: (CefrLevel as Record<string, CefrLevel>)[level] ?? CefrLevel.B1,
      hard: !!raw.hard,
    };
  }

  /**
   * RAG answer synthesis: given the user's question and the most relevant
   * knowledge entries (retrieved via Qdrant), have Claude write the answer.
   */
  async answer(question: string, sources: RagSource[]): Promise<string> {
    if (!this.enabled) {
      return 'AI is not configured. Set ANTHROPIC_API_KEY in backend/.env.';
    }
    if (sources.length === 0) {
      return "I couldn't find anything relevant in your knowledge base for that question.";
    }
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`)
      .join('\n\n---\n\n');
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system:
          'You are a personal knowledge-base assistant. Answer the question ' +
          'using ONLY the provided entries. Cite them as [1], [2], etc. If the ' +
          'entries do not contain the answer, say so plainly.',
        messages: [
          {
            role: 'user',
            content: `Knowledge base entries:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
      });
      return this.firstText(response);
    } catch (e) {
      this.logger.error(`answer() failed: ${e.message}`);
      return `AI request failed: ${e.message}`;
    }
  }
}
