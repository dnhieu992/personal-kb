'use client';

import { useEffect, useState } from 'react';
import { AREA_COLOR, AREA_LABEL, AREAS, Area, PCategory, otherArea } from '../lib/planner';
import { api } from '../lib/api';
import { Inspector } from './inspector';
import { PlannerProvider, Selection, usePlanner } from './state';
import { CategoryEditor, cx } from './ui';
import { Icon, IconName } from '../components/icons';
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
        tone === 'red' ? 'tone-red' : 'bg-emphasis text-fg-secondary',
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
          'flex h-8 w-full items-center gap-2.5 rounded-lg px-2 pr-7 text-left text-[13.5px] transition-colors',
          active ? 'bg-surface font-medium text-fg shadow-xs' : 'text-fg-secondary hover:bg-emphasis/60 hover:text-fg',
        )}
      >
        <span className="flex w-4 justify-center"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} /></span>
        <span className="truncate">{c.name}</span>
      </button>
      <button
        className="btn btn-ghost btn-icon btn-xs absolute right-1 top-1 hidden group-hover:inline-flex"
        onClick={() => setMenu(!menu)}
        title="Category options"
      >
        <Icon name="more" className="h-3.5 w-3.5" />
      </button>
      {menu && (
        <div className="popover absolute right-0 top-8 z-30 w-48" onMouseLeave={() => setMenu(false)}>
          <button className="menu-item" onClick={() => { setMenu(false); editCategory({ area: c.area, edit: c }); }}>
            Edit…
          </button>
          <button
            className="menu-item"
            onClick={() => {
              setMenu(false);
              run(api.planner.updateCategory(c.id, { area: otherArea(c.area) }));
            }}
          >
            Move to {AREA_LABEL[otherArea(c.area)]}
          </button>
          <button
            className="menu-item text-danger-text hover:bg-danger-soft hover:text-danger-text"
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
  const item = (s: Selection, icon: IconName, label: string, badge?: React.ReactNode) => (
    <button
      key={label + JSON.stringify(s)}
      onClick={() => {
        go(s);
        onPick();
      }}
      className={cx(
        'group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] transition-colors',
        same(selection, s) ? 'bg-surface font-medium text-fg shadow-xs' : 'text-fg-secondary hover:bg-emphasis/60 hover:text-fg',
      )}
    >
      <Icon name={icon} className={cx('h-4 w-4 shrink-0', same(selection, s) ? 'text-accent-text' : 'text-fg-muted')} />
      {label}
      {badge}
    </button>
  );
  const areaSection = (a: Area) => (
    <div key={a} className="space-y-0.5">
      <div className="flex items-center gap-2 px-2 pb-1 pt-4">
        <span className="h-2 w-2 rounded-sm" style={{ background: AREA_COLOR[a] }} />
        <span className="eyebrow text-fg-muted">{AREA_LABEL[a]}</span>
        <button className="btn btn-ghost btn-icon btn-xs ml-auto" title={`Add a ${AREA_LABEL[a]} category`} onClick={() => editCategory({ area: a })}>
          <Icon name="plus" className="h-3.5 w-3.5" />
        </button>
      </div>
      {item({ kind: 'tasks', area: a }, 'planner', 'Tasks', <Badge n={meta?.remainingToday[a]} />)}
      {item({ kind: 'goals', area: a }, 'target', 'Goals')}
      {item({ kind: 'notes', area: a }, 'note', 'Notes')}
      {categoriesIn(a).map((c) => (
        <CategoryItem key={c.id} c={c} onPick={onPick} />
      ))}
      <button className="flex h-7 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs text-fg-subtle hover:text-fg-secondary" onClick={() => editCategory({ area: a })}>
        <Icon name="plus" className="h-4 w-4" /> New category
      </button>
    </div>
  );
  return (
    <nav className="space-y-1">
      {AREAS.map(areaSection)}
      <div className="mt-3 space-y-0.5 border-t border-line pt-3">
        {item({ kind: 'overdue' }, 'alert', 'Overdue', <Badge n={meta?.overdue.total} tone="red" />)}
        {item({ kind: 'stats' }, 'chart', 'Stats')}
        {item({ kind: 'english' }, 'book', 'English', <Badge n={meta?.correctionCount} />)}
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
    <div className="flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        className={cx(
          'scrollbar-thin z-40 w-56 shrink-0 overflow-y-auto border-r border-line bg-subtle px-2 pb-3',
          'fixed inset-y-0 left-0 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0',
          navOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <Sidebar onPick={() => setNavOpen(false)} />
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur">
          <button className="btn btn-ghost btn-icon btn-sm md:hidden" onClick={() => setNavOpen(true)} aria-label="Planner menu">
            <Icon name="sidebar" />
          </button>
          <div className="relative w-full max-w-sm">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            id="planner-search"
            className="input input-sm h-8 w-full pl-8 pr-8"
            placeholder="Search tasks"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
          />
          <span className="kbd pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 md:inline-flex">/</span>
          </div>
          {meta && meta.englishPending > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted"><Icon name="sparkles" className="h-3.5 w-3.5 animate-pulse text-accent-text" /> Fixing English…</span>
          )}
        </div>
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger-text">
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
                'z-40 shrink-0 border-l border-line bg-surface',
                'fixed inset-y-0 right-0 w-full max-w-sm shadow-xl xl:sticky xl:inset-auto xl:top-12 xl:h-[calc(100vh-48px)] xl:w-[380px] xl:max-w-none xl:shadow-none',
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
