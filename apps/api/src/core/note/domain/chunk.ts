/**
 * Split a note into overlapping passages for embedding. MiniLM reads ~256 tokens, so a
 * whole note in one vector loses most of it; ~900-char chunks with overlap keep each
 * passage self-contained. Pure — tested in chunk.test.ts.
 */
export interface Chunk {
  index: number;
  text: string;
  /** where the passage came from: the note body or an attachment's extracted text */
  origin: string;
}

const MAX = 900;
const OVERLAP = 150;
export const MAX_CHUNKS_PER_NOTE = 60;

/** Drop what carries no meaning for search: image embeds, raw URLs, markdown noise. */
export function cleanForEmbedding(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~|-]{2,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitText(text: string, max = MAX, overlap = OVERLAP): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(t.length, start + max);
    if (end < t.length) {
      // prefer to cut at a paragraph, then a sentence, then a space
      const window = t.slice(start, end);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
      const space = window.lastIndexOf(' ');
      const at = cut > max * 0.5 ? cut + 1 : space > max * 0.5 ? space : -1;
      if (at > 0) end = start + at;
    }
    out.push(t.slice(start, end).trim());
    if (end >= t.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out.filter(Boolean);
}

/** Title prefixes every chunk so a passage still says which note it belongs to. */
export function chunkNote(title: string, content: string, attachments: { filename: string; text: string | null }[]): Chunk[] {
  const parts: { origin: string; text: string }[] = [{ origin: 'note', text: cleanForEmbedding(content) }];
  for (const a of attachments) if (a.text?.trim()) parts.push({ origin: a.filename, text: cleanForEmbedding(a.text) });
  const chunks: Chunk[] = [];
  for (const p of parts) {
    const pieces = splitText(p.text);
    if (!pieces.length && p.origin === 'note') pieces.push('');
    for (const piece of pieces) {
      const head = p.origin === 'note' ? title : `${title} — ${p.origin}`;
      chunks.push({ index: chunks.length, origin: p.origin, text: piece ? `${head}\n\n${piece}` : head });
      if (chunks.length >= MAX_CHUNKS_PER_NOTE) return chunks;
    }
  }
  return chunks;
}
