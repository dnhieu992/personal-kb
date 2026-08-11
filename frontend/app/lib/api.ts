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

export interface ImageRef {
  key: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
}

export interface Knowledge {
  id: string;
  title: string;
  /** Formatted, English body. */
  content: string;
  /** What the author typed, when the AI translated/rewrote it. */
  originalContent: string | null;
  tags: string[];
  images: ImageRef[] | null;
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

/** Body sent when creating or updating an entry. */
export interface KnowledgeInput {
  title: string;
  content: string;
  type: KnowledgeType;
  tags: string[];
  projectId?: string | null;
  images?: ImageRef[];
  /** false = store the content exactly as typed (default: AI reformats it). */
  autoFormat?: boolean;
}

export interface JournalWithItems {
  journal: Knowledge;
  items: Knowledge[];
}

/** Where a batch of collected review cards came from. */
export interface CollectedSource {
  id: string;
  title: string;
  kind: 'ENTRY' | 'TASK';
  createdAt: string;
}

/** English cards collected while saving an entry or a task, with their source. */
export interface CollectedFromSource {
  source: CollectedSource;
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

// --- Planner ---------------------------------------------------------------

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskCategory = 'COMPANY' | 'PERSONAL';

/** How far the background English pass has got on a task. */
export type CoachStatus = 'PENDING' | 'DONE' | 'SKIPPED' | 'FAILED';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = [
  'URGENT',
  'HIGH',
  'MEDIUM',
  'LOW',
];
export const TASK_CATEGORIES: TaskCategory[] = ['COMPANY', 'PERSONAL'];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-slate-100 text-slate-600',
  LOW: 'bg-slate-50 text-slate-400',
};

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  COMPANY: 'bg-indigo-100 text-indigo-700',
  PERSONAL: 'bg-emerald-100 text-emerald-700',
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  COMPANY: 'Company',
  PERSONAL: 'Personal',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export interface Task {
  id: string;
  title: string;
  /** What the author typed, when the AI corrected the title. */
  originalTitle: string | null;
  notes: string | null;
  originalNotes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  /** YYYY-MM-DD, or null for the unplanned backlog. */
  planDate: string | null;
  dueDate: string | null;
  listId: string | null;
  completedAt: string | null;
  coachStatus: CoachStatus;
  collectedCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Body sent when creating or updating a task. */
export interface TaskInput {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  planDate?: string | null;
  dueDate?: string | null;
  listId?: string | null;
  /** false = keep the text exactly as typed, no AI correction and no cards. */
  autoCoach?: boolean;
}

export interface TaskList {
  id: string;
  name: string;
  description: string | null;
  category: TaskCategory;
  targetDate: string | null;
  archived: boolean;
  taskCount?: number;
  doneCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlan {
  date: string;
  tasks: Task[];
  /** Unfinished tasks planned for an earlier day. */
  carriedOver: Task[];
  total: number;
  done: number;
}

export interface TaskStats {
  date: string;
  todayTotal: number;
  todayDone: number;
  byCategory: Record<TaskCategory, { total: number; done: number }>;
  backlog: number;
  overdue: number;
  inProgress: number;
  weekly: { date: string; planned: number; done: number }[];
}

/** Local YYYY-MM-DD — never toISOString(), which is UTC and rolls over early. */
export function isoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `date` shifted by n days, as YYYY-MM-DD. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export interface ChatResponse {
  answer: string;
  sources: { id: string; title: string; score: number }[];
}

async function requestOnce<T>(path: string, init?: RequestInit): Promise<T> {
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

// A pooled keep-alive socket that dies as the Next proxy reuses it surfaces as
// a 500 "Internal Server Error" (the proxy logs "socket hang up"). Network
// errors look the same. Both are worth one retry; a 4xx never is.
function isTransient(e: unknown): boolean {
  const message = (e as Error)?.message ?? '';
  return !/^\d/.test(message) || /^5\d\d/.test(message);
}

async function withRetry<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await requestOnce<T>(path, init);
  } catch (e) {
    if (!isTransient(e)) throw e;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return requestOnce<T>(path, init);
  }
}

// GETs are idempotent, so they always get the retry. Writes never do — a retried
// POST /knowledge would create a second entry.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method === 'GET'
    ? withRetry<T>(path, init)
    : requestOnce<T>(path, init);
}

// Opt-in for the writes that are safe to repeat: the AI endpoints persist
// nothing, so a lost socket should never reach the user.
const requestRetrying = withRetry;

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

  create: (body: KnowledgeInput) =>
    request<Knowledge>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: KnowledgeInput) =>
    request<Knowledge>(`/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Multipart upload — must NOT set a JSON Content-Type (the browser sets the
  // multipart boundary). Returns the stored image refs to attach to an entry.
  uploadImages: async (files: File[]): Promise<ImageRef[]> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const res = await fetch(`${API}/uploads/images`, {
      method: 'POST',
      body: fd,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} — ${text}`);
    }
    return res.json() as Promise<ImageRef[]>;
  },

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
    requestRetrying<{ tags: string[] }>('/ai/suggest-tags', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Reformat content into structured English Markdown (translating it) without
  // saving — used by the editor's "format now" button so the result can be
  // reviewed first.
  formatContent: (content: string, title?: string, type?: string) =>
    requestRetrying<{ content: string }>('/ai/format', {
      method: 'POST',
      body: JSON.stringify({ content, title, type }),
    }),

  chat: (question: string) =>
    request<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  english: {
    createJournal: (
      text: string,
      images?: ImageRef[],
      projectId?: string | null,
    ) =>
      request<JournalWithItems>('/knowledge/english/journal', {
        method: 'POST',
        body: JSON.stringify({
          text,
          images: images ?? [],
          projectId: projectId ?? null,
        }),
      }),

    journal: () =>
      request<JournalWithItems[]>('/knowledge/english/journal'),

    collected: (limit?: number) =>
      request<CollectedFromSource[]>(
        `/knowledge/english/collected${limit ? `?limit=${limit}` : ''}`,
      ),

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

  tasks: {
    /** A day's plan plus whatever was left unfinished before it. */
    day: (date?: string) =>
      request<DayPlan>(`/tasks/day${date ? `?date=${date}` : ''}`),

    list: (params?: {
      date?: string;
      category?: TaskCategory;
      status?: TaskStatus;
      listId?: string;
      unplanned?: boolean;
    }) => {
      const q = new URLSearchParams();
      if (params?.date) q.set('date', params.date);
      if (params?.category) q.set('category', params.category);
      if (params?.status) q.set('status', params.status);
      if (params?.listId) q.set('listId', params.listId);
      if (params?.unplanned) q.set('unplanned', 'true');
      const qs = q.toString();
      return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
    },

    get: (id: string) => request<Task>(`/tasks/${id}`),

    stats: (date?: string) =>
      request<TaskStats>(`/tasks/stats${date ? `?date=${date}` : ''}`),

    /** Returns immediately; the AI corrects the wording in the background. */
    create: (body: TaskInput) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),

    update: (id: string, body: TaskInput) =>
      request<Task>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    setStatus: (id: string, status: TaskStatus) =>
      request<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    reschedule: (id: string, planDate: string | null) =>
      request<Task>(`/tasks/${id}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ planDate }),
      }),

    /** The English review cards this task produced. */
    collected: (id: string) => request<Knowledge[]>(`/tasks/${id}/collected`),

    remove: (id: string) =>
      request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  },

  taskLists: {
    list: (includeArchived?: boolean) =>
      request<TaskList[]>(
        `/task-lists${includeArchived ? '?includeArchived=true' : ''}`,
      ),

    get: (id: string) => request<TaskList>(`/task-lists/${id}`),

    tasks: (id: string) => request<Task[]>(`/task-lists/${id}/tasks`),

    create: (body: Partial<TaskList> & { name: string }) =>
      request<TaskList>('/task-lists', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: Partial<TaskList>) =>
      request<TaskList>(`/task-lists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    remove: (id: string) =>
      request<{ deleted: boolean }>(`/task-lists/${id}`, { method: 'DELETE' }),
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
