'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { authApi } from '@/features/auth/api';
import { useProjects } from '@/features/projects/api';
import { TaskDialogHost } from '@/features/tasks/components/TaskDialog';
import { cx, ProjectDot } from '@/shared/ui/primitives';

const NAV = [
  { href: '/today', label: 'Today', icon: '☀︎' },
  { href: '/projects', label: 'Projects', icon: '▦' },
  { href: '/notes', label: 'Knowledge base', icon: '✎' },
  { href: '/search', label: 'Search', icon: '⌕' },
  { href: '/ask', label: 'Ask', icon: '✦' },
  { href: '/english', label: 'English', icon: 'Aa' },
  { href: '/diary', label: 'Diary', icon: '❦' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const projects = useProjects();
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface p-3 md:flex">
        <Link href="/today" className="mb-4 px-2 text-base font-semibold">Personal KB</Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…  ⌘K"
            className="mb-3 h-8 w-full rounded-md border border-line bg-subtle px-2.5 text-sm outline-none focus:border-accent focus:bg-surface"
          />
        </form>
        <nav className="space-y-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                pathname === n.href || pathname.startsWith(n.href + '/') ? 'bg-muted font-medium' : 'text-fg-secondary hover:bg-subtle',
              )}
            >
              <span className="w-4 text-center text-fg-subtle">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mb-1 mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Projects</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {projects.data?.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={cx('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm', pathname === `/projects/${p.id}` ? 'bg-muted font-medium' : 'text-fg-secondary hover:bg-subtle')}
            >
              <ProjectDot color={p.color} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => {
            await authApi.logout();
            router.replace('/login');
          }}
          className="mt-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-subtle"
        >
          Sign out
        </button>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cx('rounded px-2 py-1 text-sm', pathname.startsWith(n.href) ? 'bg-muted font-medium' : 'text-fg-secondary')}>
              {n.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
      <Suspense>
        <TaskDialogHost />
      </Suspense>
    </div>
  );
}
