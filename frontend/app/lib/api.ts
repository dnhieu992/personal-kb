// In the browser we hit the same-origin proxy (/api-proxy → backend), so it
// works from any host/IP without CORS. On the server (RSC data fetching) we go
// straight to the backend on localhost.
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL || '/api-proxy';
const SERVER_BASE = process.env.API_INTERNAL_URL || 'http://localhost:4001';
const API = typeof window === 'undefined' ? SERVER_BASE : BROWSER_BASE;

export type KnowledgeType =
  | 'BUG_FIX'
  | 'HOW_TO'
  | 'ARCHITECTURE'
  | 'INSIGHT'
  | 'DAILY_LOG'
  | 'ENGLISH';

export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'BUG_FIX',
  'HOW_TO',
  'ARCHITECTURE',
  'INSIGHT',
  'DAILY_LOG',
  'ENGLISH',
];

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type EnglishKind =
  | 'JOURNAL'
  | 'SENTENCE'
  | 'GRAMMAR'
  | 'MISTAKE'
  | 'VOCAB';

export const REVIEWABLE_KINDS: EnglishKind[] = [
  'SENTENCE',
  'GRAMMAR',
  'MISTAKE',
  'VOCAB',
];

export const KIND_LABELS: Record<EnglishKind, string> = {
  JOURNAL: 'Nhật ký',
  SENTENCE: 'Câu',
  GRAMMAR: 'Ngữ pháp',
  MISTAKE: 'Lỗi',
  VOCAB: 'Từ vựng',
};

export const KIND_COLORS: Record<EnglishKind, string> = {
  JOURNAL: 'bg-slate-100 text-slate-600',
  SENTENCE: 'bg-sky-100 text-sky-700',
  GRAMMAR: 'bg-violet-100 text-violet-700',
  MISTAKE: 'bg-red-100 text-red-700',
  VOCAB: 'bg-amber-100 text-amber-700',
};

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: KnowledgeType;
  codeSnippets: string[];
  summary: string;
  projectId: string | null;
  englishKind: EnglishKind | null;
  sourceId: string | null;
  hard: boolean;
  cefrLevel: CefrLevel | null;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

export interface JournalWithItems {
  journal: Knowledge;
  items: Knowledge[];
}

export interface EnglishStats {
  journalCount: number;
  itemCount: number;
  byLevel: Record<CefrLevel, number>;
  byKind: Record<string, number>;
  reviewAccuracy: number;
  dueForReview: number;
  weekly: { date: string; count: number }[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  knowledgeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  total: number;
  today: number;
  popularTags: { tag: string; count: number }[];
  recent: Knowledge[];
}

export interface ChatResponse {
  answer: string;
  sources: { id: string; title: string; score: number }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => request<Stats>('/knowledge/stats'),

  list: (params?: { type?: string; tag?: string; projectId?: string }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.tag) q.set('tag', params.tag);
    if (params?.projectId) q.set('projectId', params.projectId);
    const qs = q.toString();
    return request<Knowledge[]>(`/knowledge${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => request<Knowledge>(`/knowledge/${id}`),

  search: (q: string) =>
    request<Knowledge[]>(`/knowledge/search?q=${encodeURIComponent(q)}`),

  create: (body: {
    title: string;
    content: string;
    type: KnowledgeType;
    tags: string[];
    projectId?: string | null;
  }) =>
    request<Knowledge>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: {
      title: string;
      content: string;
      type: KnowledgeType;
      tags: string[];
      projectId?: string | null;
    },
  ) =>
    request<Knowledge>(`/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  projects: {
    list: () => request<Project[]>('/projects'),

    get: (id: string) => request<Project>(`/projects/${id}`),

    create: (body: { name: string; description?: string }) =>
      request<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: { name: string; description?: string }) =>
      request<Project>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    remove: (id: string) =>
      request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  remove: (id: string) =>
    request<{ deleted: boolean }>(`/knowledge/${id}`, { method: 'DELETE' }),

  suggestTags: (content: string) =>
    request<{ tags: string[] }>('/ai/suggest-tags', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  chat: (question: string) =>
    request<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  english: {
    createJournal: (text: string, projectId?: string | null) =>
      request<JournalWithItems>('/knowledge/english/journal', {
        method: 'POST',
        body: JSON.stringify({ text, projectId: projectId ?? null }),
      }),

    journal: () =>
      request<JournalWithItems[]>('/knowledge/english/journal'),

    review: (limit?: number) =>
      request<Knowledge[]>(
        `/knowledge/english/review${limit ? `?limit=${limit}` : ''}`,
      ),

    stats: () => request<EnglishStats>('/knowledge/english/stats'),

    recordReview: (id: string, remembered: boolean) =>
      request<Knowledge>(`/knowledge/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ remembered }),
      }),
  },
};

export const TYPE_COLORS: Record<KnowledgeType, string> = {
  BUG_FIX: 'bg-red-100 text-red-700',
  HOW_TO: 'bg-blue-100 text-blue-700',
  ARCHITECTURE: 'bg-purple-100 text-purple-700',
  INSIGHT: 'bg-amber-100 text-amber-700',
  DAILY_LOG: 'bg-emerald-100 text-emerald-700',
  ENGLISH: 'bg-sky-100 text-sky-700',
};
