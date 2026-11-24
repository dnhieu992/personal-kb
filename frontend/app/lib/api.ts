import type {
  Area,
  BoardResponse,
  GoalPeriod,
  PAttachment,
  PCategory,
  PChecklistItem,
  PCorrection,
  PGoal,
  PGoalDetail,
  PlannerMeta,
  PNote,
  PTask,
  PTaskDetail,
  RecurrenceKind,
  StatsResponse,
  TaskListResponse,
  TaskView,
} from './planner';

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
  JOURNAL: 'tone-gray',
  SENTENCE: 'tone-sky',
  GRAMMAR: 'tone-violet',
  MISTAKE: 'tone-red',
  VOCAB: 'tone-amber',
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
  kind: 'ENTRY' | 'TASK' | 'NOTE';
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
  URGENT: 'tone-red',
  HIGH: 'tone-orange',
  MEDIUM: 'tone-gray',
  LOW: 'bg-subtle text-fg-subtle',
};

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  COMPANY: 'tone-accent',
  PERSONAL: 'tone-green',
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

// --- Phrases (daily Telegram rotation) -------------------------------------

export interface Phrase {
  id: string;
  phrase: string;
  meaning: string;
  example: string | null;
  /** false = no longer sent by the daily Telegram cron. */
  active: boolean;
  /** How many times it has been sent to Telegram. */
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhraseInput {
  phrase: string;
  meaning: string;
  example?: string | null;
  active?: boolean;
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
  // Nest sends an empty body for a null result.
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
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

/** CRUD for a Markdown notebook backed by its own table (`/diary`, `/tech-notes`). */
function noteStore(base: string) {
  return {
    list: () => request<NoteEntry[]>(base),
    create: (content: string) =>
      request<NoteEntry>(base, { method: 'POST', body: JSON.stringify({ content }) }),
    update: (id: string, content: string) =>
      request<NoteEntry>(`${base}/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
    remove: (id: string) => request<{ deleted: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  /** URL of English speech (audio/wav) for `text` — played by lib/speech. */
  ttsUrl: (text: string, rate = 1) => `${API}/tts?rate=${rate}&text=${encodeURIComponent(text.trim())}`,
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

  course: {
    overview: (level?: CourseLevel) =>
      request<CourseOverview>(`/course/overview${level ? `?level=${level}` : ''}`),
    lesson: (id: string) => request<LessonDetail>(`/course/lessons/${id}`),
    submitAttempt: (id: string, body: { correct: number; total: number; answers: unknown[]; quick?: boolean }) =>
      request<AttemptResult>(`/course/lessons/${id}/attempts`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    generate: (level: CourseLevel) =>
      request<{ started: boolean; enabled: boolean }>(`/course/levels/${level}/generate`, { method: 'POST' }),
    grade: (id: string, index: number, text: string) =>
      request<WritingGrade>(`/course/lessons/${id}/grade`, { method: 'POST', body: JSON.stringify({ index, text }) }),
    regenerate: (id: string) =>
      request<CourseLesson>(`/course/lessons/${id}/regenerate`, { method: 'POST' }),
    listening: (id: string) => request<ListeningInfo>(`/course/lessons/${id}/listening`),
    generateListening: (id: string) =>
      request<ListeningInfo>(`/course/lessons/${id}/listening/generate`, { method: 'POST' }),
    gradeListening: (id: string, text: string, questionsCorrect?: number) =>
      request<SummaryGrade>(`/course/lessons/${id}/listening/grade`, {
        method: 'POST',
        body: JSON.stringify({ text, questionsCorrect }),
      }),
    journey: () => request<Journey>('/course/journey'),
    weak: () => request<WeakOverview>('/course/review/weak'),
    dailyReview: () => request<{ items: ReviewItem[]; due: number }>('/course/review/daily'),
    reviewFocus: (key: string) => request<ReviewFocus>(`/course/review/points/${encodeURIComponent(key)}`),
    submitReview: (results: { lessonId: string; index: number; correct: boolean; answer?: Record<string, unknown> }[]) =>
      request<ReviewSubmitResult>('/course/review/results', { method: 'POST', body: JSON.stringify({ results }) }),
    setGoal: (goal: { targetLevel: CourseLevel; weeklyLessons: number; startLevel?: CourseLevel; weakFirst?: boolean }) =>
      request<Journey>('/course/goal', { method: 'PUT', body: JSON.stringify(goal) }),
    placement: () => request<PlacementResult | null>('/course/placement'),
    placementTest: () => request<PlacementTest>('/course/placement/test'),
    checkBlock: (level: CourseLevel, answers: Record<string, string>) =>
      request<BlockResult>(`/course/placement/blocks/${level}`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    submitPlacement: (answers: Record<string, string>) =>
      request<PlacementResult>('/course/placement', { method: 'POST', body: JSON.stringify({ answers }) }),
    placementReview: (id: string) => request<PlacementReviewItem[] | null>(`/course/placement/${id}/review`),
    setEfset: (score: number) =>
      request<PlacementResult>('/course/placement/efset', { method: 'POST', body: JSON.stringify({ score }) }),
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

  diary: noteStore('/diary'),
  techNotes: {
    ...noteStore('/tech-notes'),
    checkEnglish: (content: string) =>
      request<EnglishCheck>('/tech-notes/english/check', { method: 'POST', body: JSON.stringify({ content }) }),
    saveCards: (cards: EnglishCard[], noteId: string | null) =>
      request<{ saved: number; skipped: number }>('/tech-notes/english/cards', {
        method: 'POST',
        body: JSON.stringify({ cards, noteId }),
      }),
  },

  phrases: {
    list: () => request<Phrase[]>('/phrases'),

    create: (body: PhraseInput) =>
      request<Phrase>('/phrases', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    update: (id: string, body: PhraseInput) =>
      request<Phrase>(`/phrases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    /** Toggle whether the daily cron still sends this phrase. */
    setActive: (id: string, active: boolean) =>
      request<Phrase>(`/phrases/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      }),

    remove: (id: string) =>
      request<{ deleted: boolean }>(`/phrases/${id}`, { method: 'DELETE' }),

    /** Send today's batch immediately (same as the daily cron). */
    sendNow: () =>
      request<{ sent: number; phrases: Phrase[] }>('/phrases/send-now', {
        method: 'POST',
      }),
  },

  /** Planner — web port of the Mac app (backend module `planner`). */
  planner: {
    meta: () => request<PlannerMeta>('/planner/meta'),

    addCategory: (body: { name: string; color: string; area: Area }) =>
      request<PCategory>('/planner/categories', { method: 'POST', body: JSON.stringify(body) }),
    updateCategory: (id: number, body: Partial<Pick<PCategory, 'name' | 'color' | 'area'>>) =>
      request<PCategory>(`/planner/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteCategory: (id: number) =>
      request<{ ok: boolean }>(`/planner/categories/${id}`, { method: 'DELETE' }),

    tasks: (p: { view: TaskView; area?: Area; categoryId?: number; goalId?: number; q?: string; anchor?: string }) => {
      const q = new URLSearchParams({ view: p.view });
      if (p.area) q.set('area', p.area);
      if (p.categoryId) q.set('categoryId', String(p.categoryId));
      if (p.goalId) q.set('goalId', String(p.goalId));
      if (p.q) q.set('q', p.q);
      if (p.anchor) q.set('anchor', p.anchor);
      return request<TaskListResponse>(`/planner/tasks?${q}`);
    },
    board: (area: Area) => request<BoardResponse>(`/planner/board?area=${area}`),
    task: (id: number) => request<PTaskDetail>(`/planner/tasks/${id}`),
    addTask: (body: {
      title: string;
      date: string | null;
      area: Area;
      categoryId?: number | null;
      goalId?: number | null;
      inProgress?: boolean;
    }) => request<PTask>('/planner/tasks', { method: 'POST', body: JSON.stringify(body) }),
    updateTask: (id: number, body: Record<string, unknown>) =>
      request<PTaskDetail>(`/planner/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    moveTask: (id: number, column: 'backlog' | 'doing' | 'done') =>
      request<{ ok: boolean }>(`/planner/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ column }) }),
    setRecurrence: (id: number, body: { kind: RecurrenceKind | null; weekdays?: number; monthDay?: number }) =>
      request<PTaskDetail>(`/planner/tasks/${id}/recurrence`, { method: 'PUT', body: JSON.stringify(body) }),
    moveOverdue: (area?: Area) =>
      request<{ moved: number }>(`/planner/tasks/move-overdue${area ? `?area=${area}` : ''}`, { method: 'POST' }),
    deleteTask: (id: number) => request<{ ok: boolean }>(`/planner/tasks/${id}`, { method: 'DELETE' }),

    addChecklist: (taskId: number, title: string) =>
      request<PChecklistItem>(`/planner/tasks/${taskId}/checklist`, { method: 'POST', body: JSON.stringify({ title }) }),
    updateChecklist: (id: number, body: { title?: string; done?: boolean }) =>
      request<PChecklistItem>(`/planner/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteChecklist: (id: number) => request<{ ok: boolean }>(`/planner/checklist/${id}`, { method: 'DELETE' }),

    addAttachment: (taskId: number, body: { kind: 'link' | 'file'; value: string; title?: string }) =>
      request<PAttachment>(`/planner/tasks/${taskId}/attachments`, { method: 'POST', body: JSON.stringify(body) }),
    deleteAttachment: (id: number) => request<{ ok: boolean }>(`/planner/attachments/${id}`, { method: 'DELETE' }),

    goals: (area?: Area, open = false) =>
      request<PGoal[]>(`/planner/goals?${new URLSearchParams({ ...(area ? { area } : {}), ...(open ? { open: 'true' } : {}) })}`),
    goal: (id: number) => request<PGoalDetail>(`/planner/goals/${id}`),
    addGoal: (body: { title: string; area: Area; categoryId?: number | null; period: GoalPeriod; periodStart: string }) =>
      request<PGoal>('/planner/goals', { method: 'POST', body: JSON.stringify(body) }),
    updateGoal: (id: number, body: Record<string, unknown>) =>
      request<PGoalDetail>(`/planner/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteGoal: (id: number) => request<{ ok: boolean }>(`/planner/goals/${id}`, { method: 'DELETE' }),

    notes: (area: Area | undefined, filter: 'all' | 'ideas' | 'daily', q?: string) => {
      const p = new URLSearchParams({ filter });
      if (area) p.set('area', area);
      if (q) p.set('q', q);
      return request<PNote[]>(`/planner/notes?${p}`);
    },
    note: (id: number) => request<PNote>(`/planner/notes/${id}`),
    addNote: (body: { area: Area; title?: string; body?: string; categoryId?: number | null }) =>
      request<PNote>('/planner/notes', { method: 'POST', body: JSON.stringify(body) }),
    updateNote: (id: number, body: Record<string, unknown>) =>
      request<PNote>(`/planner/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteNote: (id: number) => request<{ ok: boolean }>(`/planner/notes/${id}`, { method: 'DELETE' }),
    noteToTask: (id: number) => request<PTask>(`/planner/notes/${id}/to-task`, { method: 'POST' }),
    dayNote: (day: string, area: Area) =>
      request<Partial<PNote>>(`/planner/day-note?day=${day}&area=${area}`),
    saveDayNote: (day: string, area: Area, body: string) =>
      request<Partial<PNote>>('/planner/day-note', { method: 'PUT', body: JSON.stringify({ day, area, body }) }),

    stats: (period: GoalPeriod, anchor: string, area?: Area) =>
      request<StatsResponse>(`/planner/stats?period=${period}&anchor=${anchor}${area ? `&area=${area}` : ''}`),

    corrections: () => request<PCorrection[]>('/planner/corrections'),
    revertCorrection: (id: number) =>
      request<{ ok: boolean; reason?: string }>(`/planner/corrections/${id}/revert`, { method: 'POST' }),
    deleteCorrection: (id: number) => request<{ ok: boolean }>(`/planner/corrections/${id}`, { method: 'DELETE' }),
    clearCorrections: () => request<{ ok: boolean }>('/planner/corrections', { method: 'DELETE' }),
    checkEnglish: (text: string, noteId?: number) =>
      request<{ text: string; why: string; changed: boolean; enabled: boolean }>('/planner/english/check', {
        method: 'POST',
        body: JSON.stringify({ text, noteId }),
      }),
  },
};

export const TYPE_COLORS: Record<KnowledgeType, string> = {
  BUG_FIX: 'tone-red',
  HOW_TO: 'tone-blue',
  ARCHITECTURE: 'tone-violet',
  INSIGHT: 'tone-amber',
  DAILY_LOG: 'tone-green',
  ENGLISH: 'tone-sky',
};


// --- English for IT course ---

export type CourseLevel = 'A2' | 'B1' | 'B2' | 'C1';
export const COURSE_LEVELS: CourseLevel[] = ['A2', 'B1', 'B2', 'C1'];

export type LessonStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type ExerciseType = 'mcq' | 'gap' | 'order' | 'match' | 'fix' | 'listen' | 'read' | 'write';

export interface Exercise {
  type: ExerciseType;
  prompt: string;
  options: string[];
  answer: string[];
  pairs: { left: string; right: string }[];
  explanation: string;
  /** listen: what is read aloud (hidden until checked); read: the text. */
  passage?: string;
}

export interface ListeningQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface ListeningIdea {
  idea: string;
  vi: string;
}

/** A lesson's listening task: passage read aloud, questions, summary graded on key ideas. */
export interface ListeningTask {
  id: string;
  lessonId: string;
  level: CourseLevel;
  status: 'GENERATING' | 'READY' | 'FAILED';
  error: string | null;
  targetWords: number;
  title: string | null;
  context: string | null;
  passage: string | null;
  translation: string | null;
  wordCount: number;
  questions: ListeningQuestion[] | null;
  ideas: ListeningIdea[] | null;
  bestScore: number | null;
  passedAt: string | null;
  attemptCount: number;
  lastSummary: string | null;
  lastGrade: SummaryGrade | null;
}

export interface ListeningInfo {
  /** null = not written yet. */
  task: ListeningTask | null;
  targetWords: number;
  passScore: number;
  minSummaryWords: number;
  enabled: boolean;
}

export interface SummaryGrade {
  score: number;
  passed: boolean;
  ideas: (ListeningIdea & { index: number; status: 'covered' | 'partial' | 'missing'; note: string })[];
  feedback: string;
  corrected: string;
  ai: boolean;
  bestScore?: number;
}

export interface WritingGrade {
  score: number;
  correct: boolean;
  feedback: string;
  corrected: string;
  /** false = AI unavailable, only an exact model-answer match counts. */
  ai: boolean;
}

export interface VocabItem {
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
}

export interface LessonSummary {
  id: string;
  unitId: string;
  position: number;
  title: string;
  grammar: string;
  vocabTheme: string;
  objective: string;
  status: LessonStatus;
  minutes: number;
  completedAt: string | null;
  bestScore: number | null;
  attemptCount: number;
  syllabusKeys: string[] | null;
  /** REVIEW = the unit's closing mixed test (no theory/vocab). */
  kind: LessonKind;
  /** From the latest placement test: mastered points can be skipped, weak ones come first. */
  mastery: Mastery;
  locked: boolean;
}

export type Mastery = 'mastered' | 'weak' | null;
export type LessonKind = 'LESSON' | 'REVIEW';

/** The way from the start level to the end of the goal level. */
export interface Journey {
  start: CourseLevel;
  target: CourseLevel;
  goalSet: boolean;
  weeklyLessons: number;
  /** Recommend weak-point lessons before the path order. */
  weakFirst: boolean;
  /** `estimated`: not fully written yet, `total` is the planned size. */
  levels: { level: CourseLevel; done: number; total: number; estimated: boolean; minutesLeft: number }[];
  done: number;
  total: number;
  pct: number;
  minutesLeft: number;
  /** Lessons passed in the last 7 days. */
  last7: number;
  /** Lessons per week, last 4 weeks. */
  pace: number;
  streak: number;
  studiedToday: boolean;
  etaAtGoal: string | null;
  etaAtPace: string | null;
  next: {
    id: string;
    title: string;
    level: CourseLevel;
    status: LessonStatus;
    locked: boolean;
    mastery: Mastery;
    kind: LessonKind;
  } | null;
}

export interface SyllabusPoint {
  key: string;
  level: CourseLevel;
  kind: 'grammar' | 'discourse';
  name: string;
  vi: string;
}

export interface CourseFramework {
  gse: string;
  efset: string;
  canDo: string[];
  functions: string[];
  points: (SyllabusPoint & { lessonIds: string[]; done: boolean })[];
  extra: SyllabusPoint[];
  sources: { name: string; use: string; url: string }[];
}

export type PlacementSkill = 'grammar' | 'vocab' | 'reading' | 'listening';

export interface PlacementItem {
  id: string;
  level: CourseLevel;
  skill: PlacementSkill;
  key: string | null;
  prompt: string;
  options: string[];
  passage?: string;
  audio?: string;
}

export interface PlacementTest {
  levels: CourseLevel[];
  passShare: number;
  stopShare: number;
  items: PlacementItem[];
}

export interface BlockResult {
  level: CourseLevel;
  correct: number;
  total: number;
  passed: boolean;
  next: boolean;
}

export interface PlacementResult {
  id: string;
  placedLevel: CourseLevel;
  score: number;
  levels: { level: CourseLevel; correct: number; total: number; taken: boolean }[];
  skills: { skill: PlacementSkill; correct: number; total: number }[];
  mastered: string[];
  weak: string[];
  efsetScore: number | null;
  efsetLevel: string | null;
  inAppTaken: boolean;
  masteredPoints: SyllabusPoint[];
  weakPoints: SyllabusPoint[];
  createdAt: string;
}

export interface PlacementReviewItem extends PlacementItem {
  answer: string;
  chosen: string;
  correct: boolean;
}

export interface CourseLesson extends Omit<LessonSummary, 'locked' | 'mastery'> {
  level: CourseLevel;
  error: string | null;
  intro: string | null;
  theory: string | null;
  phrases: { en: string; vi: string }[] | null;
  vocab: VocabItem[] | null;
  exercises: Exercise[] | null;
}

export interface CourseUnit {
  id: string;
  level: CourseLevel;
  position: number;
  title: string;
  titleVi: string;
  summary: string;
}

export interface LevelStatus {
  level: CourseLevel;
  units: number;
  total: number;
  ready: number;
  failed: number;
  /** Older lessons still without listening/reading/writing practice. */
  needSkills: number;
  done: number;
  generating: boolean;
  error: string | null;
}

export interface CourseOverview {
  level: CourseLevel;
  levels: LevelStatus[];
  units: (CourseUnit & { lessons: LessonSummary[] })[];
  next: LessonSummary | null;
  progress: { done: number; total: number };
  averageScore: number | null;
  vocabLearned: number;
  passScore: number;
  quickPassScore: number;
  reviewPassScore: number;
  /** Planned size of a level. */
  plan: { units: number; lessonsPerUnit: number };
  journey: Journey;
  placement: PlacementResult | null;
  /** Weak-point lessons not yet passed. */
  focus: LessonSummary[];
  framework: CourseFramework | null;
}

export interface LessonDetail {
  lesson: CourseLesson;
  unit: CourseUnit | null;
  locked: boolean;
  /** For a locked lesson: the earlier lesson to pass first. */
  blockedBy: { id: string; title: string; unit: number | null; position: number } | null;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  passScore: number;
  quickPassScore: number;
  mastery: Mastery;
  points: SyllabusPoint[];
  journey: Journey;
}

export interface AttemptResult {
  score: number;
  passed: boolean;
  firstPass: boolean;
  bestScore: number;
  passScore: number;
  cardsAdded: number;
  nextId: string | null;
  journey: Journey;
}

// --- Review built on mistakes ---

export interface WeakPoint {
  key: string;
  name: string;
  vi: string;
  level: string | null;
  seen: number;
  wrong: number;
  /** % right, null before any answer. */
  accuracy: number | null;
  /** Missed exercises due now. */
  due: number;
  /** Missed exercises not resolved yet (3 right in a row resolves one). */
  open: number;
  /** Flagged by the placement test. */
  placement: boolean;
  lessons: { id: string; title: string }[];
}

export interface WeakOverview {
  points: WeakPoint[];
  due: number;
  open: number;
  resolved: number;
}

export interface ReviewItem {
  lessonId: string;
  index: number;
  lessonTitle: string;
  point: { key: string; name: string; vi: string } | null;
  exercise: Exercise;
  missed: boolean;
}

export interface ReviewFocus {
  point: { key: string; name: string; vi: string; level: string | null };
  tips: { lessonId: string; lessonTitle: string; markdown: string }[];
  mistakes: {
    lessonId: string;
    lessonTitle: string;
    index: number;
    exercise: Exercise;
    answer: Record<string, unknown> | null;
    wrong: number;
    resolved: boolean;
  }[];
  test: ReviewItem[];
}

export interface ReviewSubmitResult {
  correct: number;
  total: number;
  points: WeakPoint[];
}

/** One proposed fix from "Check English". */
export interface EnglishChange {
  original: string;
  replacement: string;
  kind: 'grammar' | 'vocab' | 'vietnamese' | 'spelling' | 'style';
  note: string;
}

export interface EnglishCard {
  front: string;
  meaning: string;
  kind: 'VOCAB' | 'MISTAKE' | 'GRAMMAR';
  example: string;
}

export interface EnglishCheck {
  corrected: string;
  changes: EnglishChange[];
  cards: EnglishCard[];
}

/** A Markdown notebook entry (diary, tech note): content + when written. */
export interface NoteEntry {
  id: string;
  content: string;
  /** When it was written (ISO). */
  createdAt: string;
  updatedAt: string;
}
