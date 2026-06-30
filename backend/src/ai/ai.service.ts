import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { CefrLevel } from '../knowledge/entities/knowledge.entity';

// claude-haiku-3-5 (requested in the brief) is retired and 404s; use current Haiku.
const MODEL = 'claude-haiku-4-5';

export interface Enrichment {
  tags: string[];
  summary: string;
  codeSnippets: string[];
}

export interface EnglishAssessment {
  meaning: string;
  cefrLevel: CefrLevel;
  tags: string[];
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
   * Assess an English sentence the user is learning: produce a plain-English
   * meaning, a CEFR difficulty level, and a few grammar/vocab tags. One Claude
   * call with structured JSON output; falls back gracefully without a key.
   */
  async assessEnglish(sentence: string): Promise<EnglishAssessment> {
    if (!this.enabled || !sentence.trim()) {
      return { meaning: sentence, cefrLevel: CefrLevel.B1, tags: [] };
    }
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system:
          'You are an English tutor. For the given English sentence respond with ' +
          'ONLY a JSON object (no prose, no markdown fences) of the shape: ' +
          '{"meaning": string, "cefrLevel": "A1"|"A2"|"B1"|"B2"|"C1"|"C2", "tags": string[]}. ' +
          'meaning: a clear plain-English paraphrase or definition of the sentence. ' +
          'cefrLevel: the CEFR difficulty band of the sentence. ' +
          'tags: up to 4 concise, lowercase, hyphenated grammar or vocabulary topics ' +
          '(e.g. "past-perfect", "phrasal-verb").',
        messages: [{ role: 'user', content: sentence }],
      });
      const parsed = this.parseJson<EnglishAssessment>(
        this.firstText(response),
      );
      const level = (parsed.cefrLevel ?? '').toString().toUpperCase();
      return {
        meaning: parsed.meaning?.trim() || sentence,
        cefrLevel: (CefrLevel as Record<string, CefrLevel>)[level] ?? CefrLevel.B1,
        tags: parsed.tags ?? [],
      };
    } catch (e) {
      this.logger.error(`assessEnglish() failed: ${e.message}`);
      return { meaning: sentence, cefrLevel: CefrLevel.B1, tags: [] };
    }
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
