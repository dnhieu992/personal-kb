'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CommandPalette, { OPEN_PALETTE } from './CommandPalette';
import { Icon } from './icons';
import { activeHref, NAV } from './nav';
import { ThemeSwitch } from './theme';
import { cx } from './ui';

/** Pages that are full-bleed apps with their own sidebar. The global one folds to a rail there. (None right now.) */
const isAppPage = (_p: string) => false;

function readPref(key: string): boolean | null {
  try {
    const v = localStorage.getItem(key);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/**
 * The app frame: grouped sidebar (collapsible to an icon rail) on desktop, a top bar
 * plus drawer on mobile, ⌘K palette everywhere. Content pages get a centred column;
 * app pages (Planner) get the full width.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '/';
  const app = isAppPage(path);
  const prefKey = app ? 'kb.rail.app' : 'kb.rail';
  const [collapsed, setCollapsed] = useState(app);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setCollapsed(readPref(prefKey) ?? app);
  }, [prefKey, app]);
  useEffect(() => setDrawer(false), [path]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(prefKey, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cx(
          'sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-150 md:block',
          collapsed ? 'w-[60px]' : 'w-60',
        )}
      >
        <SidebarContent path={path} collapsed={collapsed} onToggle={toggle} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-surface shadow-lg animate-fade-in">
            <SidebarContent path={path} collapsed={false} onToggle={() => setDrawer(false)} mobile />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <Brand />
          <button
            className="btn btn-ghost btn-icon btn-sm ml-auto"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
            aria-label="Search"
          >
            <Icon name="search" />
          </button>
        </div>

        {app ? (
          <main className="min-w-0 flex-1">{children}</main>
        ) : (
          <main className="w-full max-w-screen-2xl flex-1 px-4 py-5 sm:px-5 md:px-6 md:py-6">{children}</main>
        )}
      </div>

      <CommandPalette />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-fg" title="Personal KB">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-fg shadow-xs">
        K
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight">Personal KB</span>}
    </Link>
  );
}

function SidebarContent({
  path,
  collapsed,
  onToggle,
  mobile = false,
}: {
  path: string;
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}) {
  const active = activeHref(path);
  return (
    <div className="flex h-full flex-col">
      <div className={cx('flex h-14 items-center', collapsed ? 'justify-center' : 'justify-between px-3.5')}>
        {collapsed ? (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggle} title="Expand sidebar">
            <Icon name="sidebar" />
          </button>
        ) : (
          <>
            <Brand />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggle} title={mobile ? 'Close' : 'Collapse sidebar'}>
              <Icon name={mobile ? 'x' : 'sidebar'} />
            </button>
          </>
        )}
      </div>

      <div className={cx('space-y-1.5', collapsed ? 'px-2.5' : 'px-3')}>
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
          title="Search & commands (⌘K)"
          className={cx(
            'flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-canvas text-[13px] text-fg-subtle transition hover:border-line-strong hover:text-fg-muted',
            collapsed ? 'justify-center' : 'px-2.5',
          )}
        >
          <Icon name="search" className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <span className="kbd">⌘K</span>
            </>
          )}
        </button>
        <Link href="/knowledge/new" title="New entry" className={cx('btn btn-primary btn-sm w-full', collapsed && 'px-0')}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          {!collapsed && 'New entry'}
        </Link>
      </div>

      <nav className={cx('scrollbar-thin mt-3 flex-1 overflow-y-auto pb-3', collapsed ? 'px-2.5' : 'px-3')}>
        {NAV.map((g, gi) => (
          <div key={gi} className={cx(gi > 0 && (collapsed ? 'mt-2 border-t border-line pt-2' : 'mt-4'))}>
            {g.label && !collapsed && <p className="eyebrow mb-1 px-2.5">{g.label}</p>}
            <ul className="space-y-px">
              {g.items.map((it) => {
                const on = active === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      title={collapsed ? it.label : undefined}
                      className={cx(
                        'group flex h-8 items-center gap-2.5 rounded-lg text-[13.5px] transition-colors',
                        collapsed ? 'justify-center' : 'px-2.5',
                        on ? 'bg-accent-soft font-medium text-accent-text' : 'text-fg-secondary hover:bg-muted hover:text-fg',
                      )}
                    >
                      <Icon name={it.icon} className={cx('h-[17px] w-[17px] shrink-0', on ? 'text-accent-text' : 'text-fg-muted group-hover:text-fg-secondary')} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cx('space-y-2 border-t border-line py-3', collapsed ? 'flex flex-col items-center px-2' : 'px-3')}>
        <Link
          href="/design"
          title="Design system"
          className={cx(
            'flex h-8 items-center gap-2.5 rounded-lg text-[13px] transition-colors',
            collapsed ? 'w-8 justify-center' : 'px-2.5',
            path.startsWith('/design') ? 'bg-muted text-fg' : 'text-fg-muted hover:bg-muted hover:text-fg',
          )}
        >
          <Icon name="palette" className="h-4 w-4 shrink-0" />
          {!collapsed && 'Design system'}
        </Link>
        <ThemeSwitch compact={collapsed} />
      </div>
    </div>
  );
}
