'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Area, PCategory, PlannerMeta, TaskView } from '../lib/planner';

export type Selection =
  | { kind: 'tasks' | 'goals' | 'notes'; area: Area }
  | { kind: 'category'; id: number }
  | { kind: 'overdue' | 'stats' | 'english' };

/** Filters of the Tasks page (Today / This week / This month / All / Backlog). */
export type TaskFilter = Extract<TaskView, 'today' | 'week' | 'month' | 'all' | 'backlog'>;
export const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
  { id: 'backlog', label: 'Backlog' },
];

interface PlannerCtx {
  meta: PlannerMeta | null;
  today: string;
  /** Bumped after every change; views re-fetch when it changes. */
  rev: number;
  refresh: () => void;
  selection: Selection;
  go: (s: Selection) => void;
  selectedTaskId: number | null;
  openTask: (id: number | null) => void;
  search: string;
  setSearch: (s: string) => void;
  filter: TaskFilter;
  setFilter: (f: TaskFilter) => void;
  board: boolean;
  setBoard: (b: boolean) => void;
  categoryFilter: number | null;
  setCategoryFilter: (id: number | null) => void;
  category: (id: number | null | undefined) => PCategory | undefined;
  categoriesIn: (a: Area) => PCategory[];
  /** Opens the category editor (new when `edit` is undefined). */
  editCategory: (opts: { area: Area; edit?: PCategory; then?: (id: number) => void }) => void;
  categoryEditor: { area: Area; edit?: PCategory; then?: (id: number) => void } | null;
  closeCategoryEditor: () => void;
  run: <T>(p: Promise<T>) => Promise<T | undefined>;
  error: string | null;
  clearError: () => void;
}

const Ctx = createContext<PlannerCtx | null>(null);

export function usePlanner() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlanner outside provider');
  return c;
}

function stored<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function store(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<PlannerMeta | null>(null);
  const [rev, setRev] = useState(0);
  const [selection, setSelection] = useState<Selection>({ kind: 'tasks', area: 'WORK' });
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilterState] = useState<TaskFilter>('today');
  const [board, setBoardState] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<PlannerCtx['categoryEditor']>(null);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  // Restore per-browser preferences once.
  useEffect(() => {
    setFilterState(stored('planner.filter', 'today'));
    setBoardState(stored('planner.board', false));
    setSelection(stored('planner.selection', { kind: 'tasks', area: 'WORK' } as Selection));
    loaded.current = true;
  }, []);

  const refresh = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    api.planner.meta().then(setMeta).catch((e) => setError((e as Error).message));
  }, [rev]);

  // English corrections run in the background: poll until they have all landed.
  useEffect(() => {
    if (!meta?.englishPending) return;
    const t = setTimeout(refresh, 2500);
    return () => clearTimeout(t);
  }, [meta, refresh]);

  // Day rollover / tab coming back: refresh.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const go = useCallback((s: Selection) => {
    setSelection(s);
    setSelectedTaskId(null);
    setSearch('');
    store('planner.selection', s);
  }, []);

  const run = useCallback(
    async <T,>(p: Promise<T>) => {
      try {
        const v = await p;
        refresh();
        return v;
      } catch (e) {
        setError((e as Error).message);
        refresh();
        return undefined;
      }
    },
    [refresh],
  );

  const categories = meta?.categories ?? [];
  const value: PlannerCtx = {
    meta,
    today: meta?.today ?? new Date().toISOString().slice(0, 10),
    rev,
    refresh,
    selection,
    go,
    selectedTaskId,
    openTask: setSelectedTaskId,
    search,
    setSearch,
    filter,
    setFilter: (f) => {
      setFilterState(f);
      store('planner.filter', f);
    },
    board,
    setBoard: (b) => {
      setBoardState(b);
      store('planner.board', b);
    },
    categoryFilter,
    setCategoryFilter,
    category: (id) => (id ? categories.find((c) => c.id === id) : undefined),
    categoriesIn: (a) => categories.filter((c) => c.area === a),
    editCategory: (o) => setCategoryEditor(o),
    categoryEditor,
    closeCategoryEditor: () => setCategoryEditor(null),
    run,
    error,
    clearError: () => setError(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
