'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useProjects } from '@/features/projects/api';
import { useSearch, useSemantic } from '@/features/search/api';
import { useTaskDialog } from '@/features/tasks/useTaskDialog';
import { Empty, Input, Select, Spinner } from '@/shared/ui/primitives';

function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projects = useProjects();
  const { open } = useTaskDialog();
  const q = params.get('q') ?? '';
  const projectId = params.get('projectId') ?? '';
  const mode = params.get('mode') === 'semantic' ? 'semantic' : 'keyword';
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const res = useSearch({ q: mode === 'keyword' ? q : '', projectId: projectId || undefined });
  const sem = useSemantic(q, mode === 'semantic');

  function go(next: { q?: string; projectId?: string; mode?: string }) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    router.replace(`${pathname}?${p}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">Search</h1>
        <div className="flex rounded-lg bg-muted p-0.5 text-sm">
          {(['keyword', 'semantic'] as const).map((m) => (
            <button key={m} onClick={() => go({ mode: m === 'keyword' ? '' : m })} className={`whitespace-nowrap rounded-md px-2.5 py-1 ${mode === m ? 'bg-surface font-medium shadow-xs' : 'text-fg-muted hover:text-fg'}`}>
              {m === 'keyword' ? 'Keyword' : 'By meaning'}
            </button>
          ))}
        </div>
        <Link href={`/ask${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="btn btn-secondary btn-sm">Ask your notes →</Link>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search notes, tasks, file names…" />
        <Select value={projectId} onChange={(e) => go({ projectId: e.target.value })} className="sm:w-56">
          <option value="">All projects</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </form>
      {mode === 'semantic' ? (
        !q ? null : sem.isLoading ? (
          <Spinner />
        ) : sem.data && !sem.data.enabled ? (
          <Empty>Semantic search is switched off on this server (no QDRANT_URL).</Empty>
        ) : !sem.data?.hits.length ? (
          <Empty>Nothing close in meaning to “{q}”.</Empty>
        ) : (
          <ul className="space-y-2">
            {sem.data.hits.map((h) => (
              <li key={h.noteId}>
                <Link href={`/notes/${h.noteId}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[11px] tone-sky">note</span>
                    <span className="font-medium">{h.title}</span>
                    {h.origin !== 'note' && <span className="text-xs text-fg-muted">📎 {h.origin}</span>}
                    <span className="ml-auto text-xs tabular-nums text-fg-subtle">{Math.round(h.score * 100)}%</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-fg-secondary">{h.passage}</p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : !q ? null : res.isLoading ? (
        <Spinner />
      ) : !res.data?.hits.length ? (
        <Empty>No results for “{q}”.</Empty>
      ) : (
        <ul className="space-y-2">
          {res.data.hits.map((h) => {
            const body = (
              <>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${h.kind === 'note' ? 'tone-sky' : 'tone-violet'}`}>{h.kind}</span>
                  <span className="font-medium">{h.title}</span>
                  {h.status && <span className="text-xs text-fg-subtle">{h.status}</span>}
                  {h.projectName && <span className="ml-auto text-xs text-fg-muted">{h.projectName}</span>}
                </div>
                {h.snippet && <p className="mt-1 text-sm text-fg-secondary">{h.snippet}</p>}
                {h.matchedFiles.length > 0 && <p className="mt-1 text-xs text-fg-muted">📎 {h.matchedFiles.join(', ')}</p>}
              </>
            );
            return (
              <li key={`${h.kind}-${h.id}`}>
                {h.kind === 'note' ? (
                  <Link href={`/notes/${h.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong">{body}</Link>
                ) : (
                  <button onClick={() => open(h.id)} className="block w-full rounded-lg border border-line bg-surface p-3 text-left hover:border-line-strong">{body}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SearchView />
    </Suspense>
  );
}
