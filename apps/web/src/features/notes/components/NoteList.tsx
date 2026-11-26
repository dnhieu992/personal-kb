'use client';

import type { NoteListQuery } from '@pkb/contracts';
import Link from 'next/link';
import { Button, Empty, Spinner, Tag } from '@/shared/ui/primitives';
import { useNotes } from '../queries';

export function NoteList({ query, onTag }: { query: Partial<NoteListQuery>; onTag?: (t: string) => void }) {
  const q = useNotes(query);
  if (q.isLoading) return <Spinner />;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (!items.length) return <Empty>No notes yet.</Empty>;
  return (
    <div className="space-y-2">
      {items.map((n) => (
        <Link key={n.id} href={`/notes/${n.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong">
          <div className="flex items-start justify-between gap-3">
            <div className="font-medium">{n.title}</div>
            <div className="shrink-0 text-xs text-fg-subtle">{n.updatedAt.slice(0, 10)}</div>
          </div>
          {n.excerpt && <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{n.excerpt}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
            {n.projectName && <span className="rounded bg-muted px-1.5 py-0.5">{n.projectName}</span>}
            {n.taskTitle && <span className="rounded bg-muted px-1.5 py-0.5">↳ {n.taskTitle}</span>}
            {n.tags.map((t) => (
              <Tag key={t} name={t} onClick={onTag ? () => onTag(t) : undefined} />
            ))}
            {n.attachmentCount > 0 && <span>📎 {n.attachmentCount}</span>}
          </div>
        </Link>
      ))}
      {q.hasNextPage && (
        <Button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="w-full">
          Load more
        </Button>
      )}
    </div>
  );
}
