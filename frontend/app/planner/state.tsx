'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PlannerMeta, TaskView } from '../lib/planner';

/** Filters of a project's task list (Today / This week / This month / All / Backlog). */
export type TaskFilter = Extract<TaskView, 'today' | 'week' | 'month' | 'all' | 'backlog'>;
export const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'backlog', label: 'Backlog' },
];

interface PlannerCtx {
  meta: PlannerMeta | null;
  today: string;
  /** Bumped after every change; views re-fetch when it changes. */
  rev: number;
  refresh: () => void;
  selectedTaskId: number | null;
  openTask: (id: number | null) => void;
  filter: TaskFilter;
  setFilter: (f: TaskFilter) => void;
  board: boolean;
  setBoard: (b: boolean) => void;
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
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [filter, setFilterState] = useState<TaskFilter>('all');
  const [board, setBoardState] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore per-browser preferences once.
  useEffect(() => {
    setFilterState(stored('planner.projectFilter', 'all'));
    setBoardState(stored('planner.projectBoard', true));
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

  const value: PlannerCtx = {
    meta,
    today: meta?.today ?? new Date().toISOString().slice(0, 10),
    rev,
    refresh,
    selectedTaskId,
    openTask: setSelectedTaskId,
    filter,
    setFilter: (f) => {
      setFilterState(f);
      store('planner.projectFilter', f);
    },
    board,
    setBoard: (b) => {
      setBoardState(b);
      store('planner.projectBoard', b);
    },
    run,
    error,
    clearError: () => setError(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
