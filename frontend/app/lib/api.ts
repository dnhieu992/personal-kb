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
  | 'DAILY_LOG';

export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'BUG_FIX',
  'HOW_TO',
  'ARCHITECTURE',
  'INSIGHT',
  'DAILY_LOG',
];

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: KnowledgeType;
  codeSnippets: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
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

  list: (params?: { type?: string; tag?: string }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.tag) q.set('tag', params.tag);
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
  }) =>
    request<Knowledge>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: { title: string; content: string; type: KnowledgeType; tags: string[] },
  ) =>
    request<Knowledge>(`/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

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
};

export const TYPE_COLORS: Record<KnowledgeType, string> = {
  BUG_FIX: 'bg-red-100 text-red-700',
  HOW_TO: 'bg-blue-100 text-blue-700',
  ARCHITECTURE: 'bg-purple-100 text-purple-700',
  INSIGHT: 'bg-amber-100 text-amber-700',
  DAILY_LOG: 'bg-emerald-100 text-emerald-700',
};
