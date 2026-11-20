'use client';

import Link from 'next/link';
import { Knowledge, TYPE_COLORS } from '../lib/api';
import { Icon } from './icons';

export const typeLabel = (t: string) => t.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** One knowledge entry in a grid. The whole card opens the editor; delete appears on hover. */
export default function KnowledgeCard({ k, onDelete }: { k: Knowledge; onDelete?: (id: string) => void }) {
  return (
    <article className="card card-interactive group relative flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Link href={`/knowledge/${k.id}/edit`} className="min-w-0 flex-1 font-medium leading-snug text-fg after:absolute after:inset-0">
          {k.title}
        </Link>
        <span className={`chip shrink-0 ${TYPE_COLORS[k.type]}`}>{typeLabel(k.type)}</span>
      </div>
      {k.summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-fg-muted">{k.summary}</p>}
      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5">
          {(k.tags ?? []).slice(0, 5).map((tag) => (
            <span key={tag} className="text-xs text-fg-subtle">
              #{tag}
            </span>
          ))}
        </div>
        {typeof k.score === 'number' && (
          <span className="chip tone-accent tabular-nums" title="Similarity">
            {Math.round(k.score * 100)}%
          </span>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(k.id)}
            className="btn btn-danger-ghost btn-icon btn-xs relative z-10 transition focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            title="Delete entry"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
