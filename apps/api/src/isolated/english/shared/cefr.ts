/** CEFR difficulty bands (same values as the contracts' CefrLevel). */
export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

/** What a review card is. JOURNAL is not a card — journals live in english_journal. */
export enum EnglishKind {
  JOURNAL = 'JOURNAL',
  SENTENCE = 'SENTENCE',
  GRAMMAR = 'GRAMMAR',
  MISTAKE = 'MISTAKE',
  VOCAB = 'VOCAB',
}

export const REVIEWABLE_KINDS: EnglishKind[] = [EnglishKind.SENTENCE, EnglishKind.GRAMMAR, EnglishKind.MISTAKE, EnglishKind.VOCAB];
