'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, IconName } from './icons';
import { ALL_NAV } from './nav';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
}

/** Opens the palette from anywhere: `window.dispatchEvent(new Event(OPEN_PALETTE))`. */
export const OPEN_PALETTE = 'kb:open-palette';

/**
 * ⌘K / Ctrl+K: jump to any page, create things, or run a semantic search over the
 * knowledge base with whatever was typed.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      { id: 'new-entry', label: 'New knowledge entry', hint: 'Create', icon: 'plus', keywords: 'add note', run: go('/knowledge/new') },
      { id: 'new-journal', label: 'Write English journal', hint: 'Create', icon: 'pen', keywords: 'add diary', run: go('/english/new') },
      { id: 'new-project', label: 'New project', hint: 'Create', icon: 'folder', run: go('/projects/new') },
    ];
    const pages: Command[] = ALL_NAV.map((n) => ({
      id: n.href,
      label: n.label,
      hint: 'Go to',
      icon: n.icon,
      keywords: n.keywords,
      run: go(n.href),
    }));
    return [...pages, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(term))
      : commands;
    if (term)
      list.push({
        id: 'search',
        label: `Search knowledge for “${q.trim()}”`,
        hint: 'Semantic',
        icon: 'search',
        run: go(`/knowledge?q=${encodeURIComponent(q.trim())}`),
      });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 p-4 pt-[12vh] animate-fade-in" onMouseDown={() => setOpen(false)}>
      <div className="popover w-full max-w-lg overflow-hidden p-0" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" className="h-4 w-4 text-fg-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to a page, create, or search knowledge…"
            className="h-12 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === 'Enter') results[active]?.run();
            }}
          />
          <span className="kbd">esc</span>
        </div>
        <ul className="scrollbar-thin max-h-[50vh] overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === active ? 'bg-muted text-fg' : 'text-fg-secondary'
                }`}
              >
                <Icon name={c.icon} className="h-4 w-4 text-fg-muted" />
                <span className="flex-1 truncate">{c.label}</span>
                <span className="text-xs text-fg-subtle">{c.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
