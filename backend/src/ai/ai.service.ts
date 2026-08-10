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

/**
 * What an entry written in Vietnamese (or shaky English) teaches its author:
 * the title in correct English, plus the points worth revising later.
 */
export interface LanguageReview {
  title: string;
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

  /**
   * Rewrite a raw entry body into clean, structured Markdown — headings, lists,
   * fenced code blocks — and translate it into English, without changing what
   * it says. Used on save/update so the knowledge base stays English-only and
   * entries are readable in the UI and easier to retrieve semantically.
   * Returns the original content untouched when AI is off or the call fails.
   */
  async formatContent(
    content: string,
    title = '',
    type = '',
  ): Promise<string> {
    if (!this.enabled || !content.trim()) return content;
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        // Generous, because the reply restates the whole entry: too low and the
        // model stops mid-entry (see the stop_reason guard below).
        max_tokens: 16_000,
        system:
          'You reformat personal knowledge-base entries into clean Markdown and ' +
          'translate them into English. ' +
          'Respond with ONLY the reformatted Markdown body — no preamble, no ' +
          'explanation, and do NOT wrap the whole answer in a code fence.\n' +
          'Rules:\n' +
          '- Preserve 100% of the meaning. Never add facts, opinions or ' +
          'conclusions that are not already there, and never drop any — ' +
          'including time markers ("today"), asides and hedges.\n' +
          '- ALWAYS write the result in English. The author is Vietnamese and may ' +
          'write in Vietnamese, in English, or mix the two: translate every ' +
          'sentence — headings, list items, table cells, image captions and link ' +
          'text included — into natural, idiomatic English with correct grammar. ' +
          'No Vietnamese prose may remain in the output.\n' +
          '- Translate the meaning, not the words: write what a fluent engineer ' +
          'would write, silently fixing the grammar and word choice of any ' +
          'English the author wrote. Keep their voice and register.\n' +
          '- Leave untranslated and byte-for-byte unchanged: anything inside ' +
          'fenced or inline code, identifiers, file paths, commands, env vars, ' +
          'URLs, log and error output, and proper nouns (product, service, ' +
          'people and company names).\n' +
          '- Structure with `##`/`###` headings when the entry has distinct ' +
          'sections; short entries can stay a single paragraph or list.\n' +
          '- The title is shown separately by the UI — never repeat it as a ' +
          'heading and never open with an `#` heading of the whole entry.\n' +
          '- Ordered lists for step-by-step flows, bullets otherwise; bold key ' +
          'numbers; wrap identifiers (files, tables, columns, functions, env ' +
          'vars, commands) in inline `code`.\n' +
          '- Put code in fenced blocks with a language hint.\n' +
          '- Reproduce Markdown images and links verbatim, URLs unchanged.\n' +
          '- Beyond the translation, do not rewrite sentences that are already ' +
          'clear correct English — fix typos and spacing and leave them be.\n' +
          '- If the content is already well-formatted English Markdown, return ' +
          'it essentially unchanged.',
        messages: [
          {
            role: 'user',
            content:
              `Title: ${title || '(none)'}\nType: ${type || '(none)'}\n\n` +
              `Content to reformat:\n${content}`,
          },
        ],
      });
      // A reply cut off at the token ceiling would silently truncate the
      // entry, so keep the original instead of saving half of it.
      if (response.stop_reason === 'max_tokens') {
        this.logger.warn(
          `formatContent(): reply hit max_tokens for a ${content.length}-char ` +
            'entry — keeping the original content.',
        );
        return content;
      }
      const formatted = this.stripOuterFence(this.firstText(response));
      // Never let an empty reply clobber the user's text.
      return formatted.trim() ? formatted : content;
    } catch (e) {
      this.logger.error(`formatContent() failed: ${e.message}`);
      return content;
    }
  }

  /** Drop a ```markdown fence the model may have wrapped the whole reply in. */
  private stripOuterFence(raw: string): string {
    const text = raw.trim();
    const match = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(text);
    return match ? match[1] : text;
  }

  /**
   * Read what the author actually typed (before translation) and collect the
   * English they should revise later: grammar they got wrong or avoided, words
   * they wrote in Vietnamese because they did not know the English one, and
   * words used in the wrong context. Also returns the title in correct English.
   * Runs alongside formatContent() on save; falls back to "nothing to review".
   */
  async reviewEnglishUsage(
    title: string,
    content: string,
  ): Promise<LanguageReview> {
    if (!this.enabled || !content.trim()) return { title, items: [] };
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system:
          'You are an English coach for a Vietnamese software engineer. They ' +
          'write knowledge-base entries in Vietnamese, in English, or a mix; ' +
          'the app translates the entry for them, and your job is to collect ' +
          'what they should study so their own English improves. ' +
          'Respond with ONLY a JSON object (no prose, no markdown fences) of the ' +
          'shape: {"title": string, "items": [{"kind": "GRAMMAR"|"MISTAKE"|' +
          '"VOCAB"|"SENTENCE", "front": string, "meaning": string, "cefrLevel": ' +
          '"A1"|"A2"|"B1"|"B2"|"C1"|"C2", "hard": boolean}]}.\n' +
          'title: the entry title in natural, correct English — translate it if ' +
          'needed. Under 120 characters, no trailing period.\n' +
          'items: at most 8, each a distinct thing THIS author got wrong or ' +
          'could not say. Never invent generic lessons the entry does not ' +
          'support.\n' +
          '- MISTAKE: English they wrote with wrong grammar or wrong word ' +
          'choice. front = their wording, verbatim. meaning = the corrected ' +
          'English, then a short reason in Vietnamese.\n' +
          '- GRAMMAR: a grammar point they need to revise (articles, tense, ' +
          'conditionals, word order…). front = the point named in English with ' +
          'a correct example. meaning = the rule in Vietnamese, pointing at what ' +
          'they wrote.\n' +
          '- VOCAB: a word or phrase they wrote in Vietnamese (so they likely ' +
          'did not know the English), or an English word they used in the wrong ' +
          'context. front = the correct English word/phrase. meaning = the ' +
          'Vietnamese meaning plus a short example of correct use.\n' +
          '- SENTENCE: only for a genuinely useful sentence from the entry worth ' +
          'memorising as a model.\n' +
          'hard = true when the same problem shows up more than once in the ' +
          'entry. cefrLevel = the difficulty of the item itself.\n' +
          'Ignore code, identifiers, commands, URLs, log output and proper nouns ' +
          '— never mine them for vocabulary. Skip pure typos and anything ' +
          'trivial. If the entry is already correct, natural English, return an ' +
          'empty items array.',
        messages: [
          {
            role: 'user',
            content: `Title: ${title || '(none)'}\n\nEntry as typed:\n${content}`,
          },
        ],
      });
      const parsed = this.parseJson<LanguageReview>(this.firstText(response));
      const items = (parsed.items ?? [])
        .map((it) => this.normaliseItem(it))
        .filter((it): it is ExtractedItem => it !== null);
      return { title: parsed.title?.trim() || title, items };
    } catch (e) {
      this.logger.error(`reviewEnglishUsage() failed: ${e.message}`);
      return { title, items: [] };
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
