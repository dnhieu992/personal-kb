import { describe, expect, it } from 'vitest';
import { chunkNote, cleanForEmbedding, MAX_CHUNKS_PER_NOTE, splitText } from './chunk';

describe('splitText', () => {
  it('keeps short text whole', () => {
    expect(splitText('hello world')).toEqual(['hello world']);
    expect(splitText('   ')).toEqual([]);
  });

  it('splits long text with overlap and covers every word', () => {
    const words = Array.from({ length: 600 }, (_, i) => `w${i}`);
    const parts = splitText(words.join(' '), 300, 50);
    expect(parts.length).toBeGreaterThan(5);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(300);
    const seen = new Set(parts.join(' ').split(/\s+/));
    for (const w of words) expect(seen.has(w)).toBe(true);
    // consecutive chunks overlap
    const lastOfFirst = parts[0].split(' ').pop()!;
    expect(parts[1].includes(lastOfFirst)).toBe(true);
  });

  it('prefers paragraph boundaries', () => {
    const a = 'a'.repeat(200);
    const parts = splitText(`${a}\n\n${'b'.repeat(200)}`, 300, 0);
    expect(parts[0]).toBe(a);
  });
});

describe('cleanForEmbedding', () => {
  it('drops images and urls but keeps link text', () => {
    expect(cleanForEmbedding('see ![x](http://i/x.png) the [docs](https://d.io/a) at https://e.com now')).toBe('see the docs at now');
  });
});

describe('chunkNote', () => {
  it('prefixes the title and includes attachment text', () => {
    const c = chunkNote('Kafka', 'Rebalance happens when…', [{ filename: 'spec.pdf', text: 'Consumer groups' }, { filename: 'x.png', text: null }]);
    expect(c.map((x) => x.origin)).toEqual(['note', 'spec.pdf']);
    expect(c[0].text.startsWith('Kafka\n\n')).toBe(true);
    expect(c[1].text.startsWith('Kafka — spec.pdf')).toBe(true);
    expect(c.map((x) => x.index)).toEqual([0, 1]);
  });

  it('an empty note still gets its title indexed', () => {
    expect(chunkNote('Only a title', '', [])).toEqual([{ index: 0, origin: 'note', text: 'Only a title' }]);
  });

  it('caps the number of chunks', () => {
    const huge = Array.from({ length: 20000 }, (_, i) => `word${i}`).join(' ');
    expect(chunkNote('t', huge, []).length).toBe(MAX_CHUNKS_PER_NOTE);
  });
});
