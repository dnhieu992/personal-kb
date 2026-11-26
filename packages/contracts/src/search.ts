import { z } from 'zod';

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  projectId: z.string().uuid().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchHit = z.object({
  kind: z.enum(['note', 'task']),
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  /** for task hits */
  status: z.string().nullable(),
  /** filenames that matched (note hits) */
  matchedFiles: z.array(z.string()),
  score: z.number(),
  updatedAt: z.string(),
});
export type SearchHit = z.infer<typeof SearchHit>;

export const SearchResult = z.object({ hits: z.array(SearchHit) });
export type SearchResult = z.infer<typeof SearchResult>;

// ---- Phase 3: semantic search + ask (RAG) ----
export const SemanticQuery = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});
export type SemanticQuery = z.infer<typeof SemanticQuery>;
export const SemanticHit = z.object({
  noteId: z.string(),
  title: z.string(),
  score: z.number(),
  passage: z.string(),
  origin: z.string(),
  projectId: z.string().nullable(),
  updatedAt: z.string(),
});
export type SemanticHit = z.infer<typeof SemanticHit>;
export const SemanticResult = z.object({ enabled: z.boolean(), hits: z.array(SemanticHit) });
export type SemanticResult = z.infer<typeof SemanticResult>;

export const AskInput = z.object({ question: z.string().trim().min(1).max(2000) });
export type AskInput = z.infer<typeof AskInput>;
export const AskSource = z.object({ n: z.number(), noteId: z.string(), title: z.string(), origin: z.string(), score: z.number() });
export type AskSource = z.infer<typeof AskSource>;
export const AskResult = z.object({ answer: z.string(), sources: z.array(AskSource) });
export type AskResult = z.infer<typeof AskResult>;
