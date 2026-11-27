'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { authApi } from '@/features/auth/api';
import { Avatar } from '@/features/profile/Avatar';
import { useProfile } from '@/features/profile/api';
import { TaskDialogHost } from '@/features/tasks/components/TaskDialog';
import { Icon, IconName } from '@/shared/ui/icons';
import { cx } from '@/shared/ui/primitives';
import { ThemeSwitch } from '@/shared/ui/theme';

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

/** The app's information architecture — one place, read by the sidebar and the mobile drawer. */
const NAV: NavGroup[] = [
  {
    items: [
      { href: '/today', label: 'Today', icon: 'sun' },
      { href: '/search', label: 'Search', icon: 'search' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects', label: 'Projects', icon: 'folder' },
      { href: '/notes', label: 'Knowledge base', icon: 'book' },
      { href: '/ask', label: 'Ask AI', icon: 'sparkles' },
    ],
  },
  {
    label: 'English',
    items: [
      { href: '/english', label: 'Course', icon: 'graduation', exact: true },
      { href: '/english/review', label: 'Review', icon: 'cards' },
      { href: '/english/journal', label: 'Journal', icon: 'pen' },
      { href: '/english/phrases', label: 'Phrases', icon: 'quote' },
      { href: '/english/games', label: 'Games', icon: 'gamepad' },
      { href: '/english/placement', label: 'Placement test', icon: 'target' },
    ],
  },
];
const ALL = NAV.flatMap((g) => g.items);

/** The nav item a path belongs to: the longest href that is the path or (unless exact) a parent of it. */
function activeHref(path: string): string | null {
  let best: string | null = null;
  for (const it of ALL) {
    const hit = path === it.href || (!it.exact && path.startsWith(it.href + '/'));
    if (hit && (!best || it.href.length > best.length)) best = it.href;
  }
  // English lesson pages belong to the course.
  if (!best && path.startsWith('/english/')) best = '/english';
  return best;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
  }, [drawer]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface md:block">
        <Sidebar path={pathname} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-line bg-surface shadow-lg animate-fade-in">
            <Sidebar path={pathname} onClose={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur md:hidden">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <Brand />
          <Link href="/search" className="btn btn-ghost btn-icon btn-sm ml-auto" aria-label="Search">
            <Icon name="search" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>

      <Suspense>
        <TaskDialogHost />
      </Suspense>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/today" className="flex items-center gap-2 rounded-md text-fg">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-fg shadow-xs">K</span>
      <span className="text-[15px] font-semibold tracking-tight">Personal KB</span>
    </Link>
  );
}

function Sidebar({ path, onClose }: { path: string; onClose?: () => void }) {
  const router = useRouter();
  const active = activeHref(path);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onClose) return; // only the desktop sidebar owns ⌘K
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Brand />
        {onClose && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close menu">
            <Icon name="x" />
          </button>
        )}
      </div>

      <form
        className="px-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 text-fg-subtle focus-within:border-accent focus-within:bg-surface">
          <Icon name="search" className="h-3.5 w-3.5 shrink-0" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes & tasks…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
          {!onClose && <span className="kbd">⌘K</span>}
        </label>
      </form>

      <nav className="scrollbar-thin mt-2 flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g, gi) => (
          <div key={gi} className={cx(gi > 0 && 'mt-5')}>
            {g.label && <p className="eyebrow mb-1.5 px-2.5">{g.label}</p>}
            <ul className="space-y-px">
              {g.items.map((it) => (
                <li key={it.href}>
                  <NavLink item={it} on={active === it.href} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        <UserMenu path={path} />
      </div>
    </div>
  );
}

/** Avatar + name at the bottom of the sidebar; the menu (My Notes, Profile, theme, sign out) opens on click. */
function UserMenu({ path }: { path: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = profile.data?.displayName ?? 'Me';
  const url = profile.data?.avatarUrl ?? null;

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-fg-secondary transition-colors hover:bg-muted hover:text-fg';

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 animate-pop-in rounded-xl border border-line bg-surface p-1.5 shadow-lg" role="menu">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={name} url={url} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              {profile.data?.email && <p className="truncate text-xs text-fg-muted">{profile.data.email}</p>}
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link href="/my-notes" className={item} role="menuitem">
            <Icon name="lock" className="h-4 w-4 text-fg-muted" /> My Notes
          </Link>
          <Link href="/profile" className={item} role="menuitem">
            <Icon name="user" className="h-4 w-4 text-fg-muted" /> Profile
          </Link>
          <div className="my-1 border-t border-line" />
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-[13px] text-fg-muted">
            Theme
            <div className="w-28">
              <ThemeSwitch />
            </div>
          </div>
          <button
            className={item}
            role="menuitem"
            onClick={async () => {
              await authApi.logout();
              router.replace('/login');
            }}
          >
            <Icon name="logout" className="h-4 w-4 text-fg-muted" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx('flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted', open && 'bg-muted')}
      >
        <Avatar name={name} url={url} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-fg">{name}</span>
          {profile.data?.email && <span className="block truncate text-xs text-fg-muted">{profile.data.email}</span>}
        </span>
        <Icon name="chevron-down" className={cx('h-4 w-4 text-fg-subtle transition-transform', open ? '' : 'rotate-180')} />
      </button>
    </div>
  );
}

function NavLink({ item, on }: { item: NavItem; on: boolean }) {
  return (
    <Link
      href={item.href}
      className={cx(
        'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
        on ? 'bg-accent-soft font-medium text-accent-text' : 'text-fg-secondary hover:bg-muted hover:text-fg',
      )}
    >
      <Icon name={item.icon} className={cx('h-[17px] w-[17px] shrink-0', on ? 'text-accent-text' : 'text-fg-muted group-hover:text-fg-secondary')} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
