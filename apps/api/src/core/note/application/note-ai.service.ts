import { BadRequestException, Injectable } from '@nestjs/common';
import type { NoteAiInput, RewriteResult, SuggestTagsResult, SummarizeResult } from '@pkb/contracts';
import { AiGateway, FAST_MODEL } from '../../../platform/ai/ai.gateway';
import { normalizeTags } from '../domain/note-rules';

const MAX_INPUT = 30_000;

/**
 * Note AI tools (SPEC §6: on click only, never on save). Prompts live here, with the module
 * that owns notes; the gateway only runs them. Results are proposals — the editor decides.
 */
@Injectable()
export class NoteAiService {
  constructor(private readonly ai: AiGateway) {}

  private body(input: NoteAiInput) {
    const content = input.content.trim();
    if (!content) throw new BadRequestException('The note is empty.');
    return `${input.title?.trim() ? `# ${input.title.trim()}\n\n` : ''}${content}`.slice(0, MAX_INPUT);
  }

  async suggestTags(input: NoteAiInput, existing: string[]): Promise<SuggestTagsResult> {
    this.ai.assertEnabled();
    const { data } = await this.ai.ask<{ tags: string[] }>({
      module: 'note',
      purpose: 'suggest-tags',
      model: FAST_MODEL,
      system:
        'You tag notes in a personal technical knowledge base. Return 3-6 concise, lowercase topic tags ' +
        '(single words or short hyphenated phrases, e.g. "kafka", "system-design", "mysql"). Prefer tags from the ' +
        'EXISTING list when they fit; only invent a new one when none does. No generic tags like "notes" or "misc".',
      user: `EXISTING TAGS: ${existing.slice(0, 200).join(', ') || '(none)'}\n\nNOTE:\n${this.body(input)}`,
      schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } }, required: ['tags'], additionalProperties: false },
    });
    return { tags: normalizeTags(data?.tags ?? []).slice(0, 6) };
  }

  async summarize(input: NoteAiInput): Promise<SummarizeResult> {
    this.ai.assertEnabled();
    const { data } = await this.ai.ask<{ summary: string }>({
      module: 'note',
      purpose: 'summarize',
      model: FAST_MODEL,
      system:
        'Summarize the note for its author, in English, as Markdown: one sentence TL;DR, then 3-6 bullet points ' +
        'with the key facts, commands or decisions. Keep code identifiers verbatim. No preamble.',
      user: this.body(input),
      schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false },
    });
    return { summary: data?.summary?.trim() ?? '' };
  }

  async rewrite(input: NoteAiInput): Promise<RewriteResult> {
    this.ai.assertEnabled();
    const { data } = await this.ai.ask<{ content: string }>({
      module: 'note',
      purpose: 'rewrite',
      model: FAST_MODEL,
      effort: 'medium',
      system:
        'Rewrite the note body more concisely in clear English Markdown. Keep every fact, command, code block, ' +
        'link and image EXACTLY as written (do not alter code or URLs). Keep the heading structure; remove ' +
        'repetition and filler. Return only the rewritten body (without the title).',
      user: this.body(input),
      schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'], additionalProperties: false },
    });
    if (!data?.content?.trim()) throw new BadRequestException('The AI returned nothing — try again.');
    return { content: data.content.trim() };
  }
}
