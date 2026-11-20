'use client';

import { useEffect, useState } from 'react';
import { AREA_COLOR, AREA_ICON, AREA_LABEL, AREAS, Area, PCategory, otherArea } from '../lib/planner';
import { api } from '../lib/api';
import { Inspector } from './inspector';
import { PlannerProvider, Selection, usePlanner } from './state';
import { CategoryEditor, cx } from './ui';
import { EnglishView, StatsView } from './views-stats-english';
import { GoalsView, NotesView } from './views-goals-notes';
import { CategoryTasksView, OverdueView, SearchResults, TasksView } from './views-tasks';

/**
 * Planner — the web version of the "Planner" Mac app. Work / Personal areas,
 * todo-style tasks (Today / Week / Month / All / Backlog filters + Kanban),
 * goals, notes, stats and an English auto-correct log.
 */
export default function PlannerPage() {
  return (
    <PlannerProvider>
      <Shell />
      <CategoryEditor />
    </PlannerProvider>
  );
}

function same(a: Selection, b: Selection) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Badge({ n, tone = 'slate' }: { n?: number; tone?: 'slate' | 'red' }) {
  if (!n) return null;
  return (
    <span
      className={cx(
        'ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
        tone === 'red' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600',
      )}
    >
      {n}
    </span>
  );
}

function CategoryItem({ c, onPick }: { c: PCategory; onPick: () => void }) {
  const { selection, go, editCategory, run } = usePlanner();
  const [menu, setMenu] = useState(false);
  const active = same(selection, { kind: 'category', id: c.id });
  return (
    <div className="group relative">
      <button
        onClick={() => {
          go({ kind: 'category', id: c.id });
          onPick();
        }}
        className={cx(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
          active ? 'bg-white font-medium shadow-sm' : 'text-slate-700 hover:bg-slate-200/60',
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
        <span className="truncate">{c.name}</span>
      </button>
      <button
        className="absolute right-1 top-1 hidden rounded px-1 text-xs text-slate-500 hover:bg-slate-300 group-hover:block"
        onClick={() => setMenu(!menu)}
        title="Category options"
      >
        ⋯
      </button>
      {menu && (
        <div className="absolute right-0 top-7 z-30 w-44 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg" onMouseLeave={() => setMenu(false)}>
          <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { setMenu(false); editCategory({ area: c.area, edit: c }); }}>
            Edit…
          </button>
          <button
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
            onClick={() => {
              setMenu(false);
              run(api.planner.updateCategory(c.id, { area: otherArea(c.area) }));
            }}
          >
            Move to {AREA_LABEL[otherArea(c.area)]}
          </button>
          <button
            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
            onClick={async () => {
              setMenu(false);
              if (!confirm(`Delete category “${c.name}”? Tasks in it are kept; they just lose the category.`)) return;
              if (active) go({ kind: 'tasks', area: c.area });
              await run(api.planner.deleteCategory(c.id));
            }}
          >
            Delete…
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onPick }: { onPick: () => void }) {
  const { selection, go, meta, categoriesIn, editCategory } = usePlanner();
  const item = (s: Selection, icon: string, label: string, badge?: React.ReactNode) => (
    <button
      key={label + JSON.stringify(s)}
      onClick={() => {
        go(s);
        onPick();
      }}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm',
        same(selection, s) ? 'bg-white font-medium shadow-sm' : 'text-slate-700 hover:bg-slate-200/60',
      )}
    >
      <span className="w-5 text-center">{icon}</span>
      {label}
      {badge}
    </button>
  );
  const areaSection = (a: Area) => (
    <div key={a} className="space-y-0.5">
      <div className="flex items-center px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide" style={{ color: AREA_COLOR[a] }}>
        {AREA_ICON[a]} <span className="ml-1">{AREA_LABEL[a]}</span>
        <button className="ml-auto rounded px-1 hover:bg-slate-200" title={`Add a ${AREA_LABEL[a]} category`} onClick={() => editCategory({ area: a })}>
          +
        </button>
      </div>
      {item({ kind: 'tasks', area: a }, '☑️', 'Tasks', <Badge n={meta?.remainingToday[a]} />)}
      {item({ kind: 'goals', area: a }, '🎯', 'Goals')}
      {item({ kind: 'notes', area: a }, '📝', 'Notes')}
      {categoriesIn(a).map((c) => (
        <CategoryItem key={c.id} c={c} onPick={onPick} />
      ))}
      <button className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs text-slate-400 hover:text-slate-600" onClick={() => editCategory({ area: a })}>
        <span className="w-5 text-center">⊕</span> New category
      </button>
    </div>
  );
  return (
    <nav className="space-y-1">
      {AREAS.map(areaSection)}
      <div className="space-y-0.5 border-t border-slate-200 pt-3">
        {item({ kind: 'overdue' }, '⚠️', 'Overdue', <Badge n={meta?.overdue.total} tone="red" />)}
        {item({ kind: 'stats' }, '📊', 'Stats')}
        {item({ kind: 'english' }, '📖', 'English', <Badge n={meta?.correctionCount} />)}
      </div>
    </nav>
  );
}

function Shell() {
  const { selection, search, setSearch, selectedTaskId, openTask, setBoard, board, error, clearError, meta } = usePlanner();
  const [navOpen, setNavOpen] = useState(false);
  const [q, setQ] = useState(search);

  useEffect(() => setQ(search), [search]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 250);
    return () => clearTimeout(t);
  }, [q, setSearch]);

  // Shortcuts: "b" toggles list/board, Escape closes the inspector, "/" focuses search.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'b' && selection.kind === 'tasks') setBoard(!board);
      if (e.key === 'Escape') openTask(null);
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('planner-search')?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [selection.kind, board, setBoard, openTask]);

  const searching = search.trim().length > 0;
  let main: React.ReactNode;
  if (searching) main = <SearchResults q={search.trim()} />;
  else
    switch (selection.kind) {
      case 'tasks':
        main = <TasksView area={selection.area} />;
        break;
      case 'goals':
        main = <GoalsView area={selection.area} />;
        break;
      case 'notes':
        main = <NotesView area={selection.area} />;
        break;
      case 'category':
        main = <CategoryTasksView id={selection.id} />;
        break;
      case 'overdue':
        main = <OverdueView />;
        break;
      case 'stats':
        main = <StatsView />;
        break;
      case 'english':
        main = <EnglishView />;
        break;
    }

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 57px)' }}>
      {/* Sidebar */}
      <aside
        className={cx(
          'z-40 w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-100 px-2 py-3',
          'fixed inset-y-0 left-0 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0',
          navOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <Sidebar onPick={() => setNavOpen(false)} />
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-slate-900/20 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2 backdrop-blur">
          <button className="rounded-md px-2 py-1 text-lg hover:bg-slate-200 md:hidden" onClick={() => setNavOpen(true)} aria-label="Menu">
            ☰
          </button>
          <input
            id="planner-search"
            className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
            placeholder="Search tasks…  ( / )"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          />
          {meta && meta.englishPending > 0 && (
            <span className="ml-auto whitespace-nowrap text-xs text-slate-400">✨ fixing English…</span>
          )}
        </div>
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
            <button className="ml-auto" onClick={clearError}>
              ×
            </button>
          </div>
        )}
        <div className="flex min-w-0 flex-1">
          <main className="min-w-0 flex-1 px-4 py-4 md:px-6">{main}</main>
          {selectedTaskId && (
            <aside
              className={cx(
                'z-40 shrink-0 border-l border-slate-200 bg-white',
                'fixed inset-y-0 right-0 w-full max-w-sm shadow-xl xl:sticky xl:inset-auto xl:top-[49px] xl:h-[calc(100vh-49px)] xl:w-[380px] xl:max-w-none xl:shadow-none',
              )}
            >
              <Inspector />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
