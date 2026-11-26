import { Injectable } from '@nestjs/common';
import type { AskResult, SemanticResult } from '@pkb/contracts';
import { AiGateway, FAST_MODEL } from '../../platform/ai/ai.gateway';
import { NoteIndexService, NoteService } from '../note';

const ASK_SYSTEM =
  'You answer questions using ONLY the numbered excerpts from the user\'s personal knowledge base. ' +
  'Cite excerpts inline as [1], [2]. If the excerpts do not contain the answer, say so plainly and suggest ' +
  'what to search for — never invent facts. Answer in the language of the question, concisely, in Markdown; ' +
  'keep code and commands verbatim.';

/** Semantic search + RAG over notes (Phase 3). Composes the note module's public index. */
@Injectable()
export class AskService {
  constructor(
    private readonly index: NoteIndexService,
    private readonly notes: NoteService,
    private readonly ai: AiGateway,
  ) {}

  async semantic(q: string, limit: number): Promise<SemanticResult> {
    if (!this.index.semanticEnabled()) return { enabled: false, hits: [] };
    const hits = await this.index.semantic(q, limit);
    const refs = await this.notes.refsByIds(hits.map((h) => h.noteId));
    return {
      enabled: true,
      hits: hits
        .filter((h) => refs.has(h.noteId))
        .map((h) => {
          const r = refs.get(h.noteId)!;
          return { noteId: h.noteId, title: r.title, score: h.score, passage: stripTitle(h.text, r.title).slice(0, 400), origin: h.origin, projectId: r.projectId, updatedAt: r.updatedAt.toISOString() };
        }),
    };
  }

  async ask(question: string): Promise<AskResult> {
    this.ai.assertEnabled();
    const passages = this.index.semanticEnabled() ? await this.index.passages(question, 8) : [];
    const refs = await this.notes.refsByIds([...new Set(passages.map((p) => p.noteId))]);
    const used = passages.filter((p) => refs.has(p.noteId) && p.score > 0.2);
    if (!used.length) {
      return { answer: "I couldn't find anything about that in your notes.", sources: [] };
    }
    const context = used.map((p, i) => `[${i + 1}] (${refs.get(p.noteId)!.title}${p.origin !== 'note' ? ` — ${p.origin}` : ''})\n${p.text}`).join('\n\n---\n\n');
    const r = await this.ai.ask({
      module: 'search',
      purpose: 'ask',
      model: FAST_MODEL,
      system: ASK_SYSTEM,
      user: `EXCERPTS:\n\n${context}\n\nQUESTION: ${question}`,
    });
    return {
      answer: r.text.trim(),
      sources: used.map((p, i) => ({ n: i + 1, noteId: p.noteId, title: refs.get(p.noteId)!.title, origin: p.origin, score: p.score })),
    };
  }
}

function stripTitle(text: string, title: string) {
  const nl = text.indexOf('\n\n');
  return nl > -1 && text.slice(0, nl).startsWith(title) ? text.slice(nl + 2) : text;
}
