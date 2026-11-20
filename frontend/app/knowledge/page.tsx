'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, Knowledge, KNOWLEDGE_TYPES, KnowledgeType } from '../lib/api';
import KnowledgeCard, { typeLabel } from '../components/KnowledgeCard';
import { Icon } from '../components/icons';
import { Alert, cx, EmptyState, Loading, PageHeader } from '../components/ui';

function KnowledgeList() {
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';

  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<KnowledgeType | ''>('');
  const [tagFilter, setTagFilter] = useState(params.get('tag') ?? '');
  const [query, setQuery] = useState(initialQ);
  // The query the results on screen were searched with ('' = browsing with filters).
  const [searched, setSearched] = useState(initialQ);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(
        searched
          ? await api.search(searched)
          : await api.list({ type: typeFilter || undefined, tag: tagFilter || undefined }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searched, typeFilter, tagFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = params.get('q') ?? '';
    setQuery(q);
    setSearched(q);
  }, [params]);

  async function onDelete(id: string) {
    if (!confirm('Delete this entry?')) return;
    await api.remove(id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Entries"
        description="Everything you've captured — browse by type and tag, or search by meaning."
        actions={
          <Link href="/knowledge/new" className="btn btn-primary">
            <Icon name="plus" /> New entry
          </Link>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(query.trim());
        }}
        className="relative"
      >
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by meaning — e.g. “how did we speed up the orders API”"
          className="input h-11 w-full pl-10 pr-28 text-[15px]"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1">
          {searched && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQuery('');
                setSearched('');
              }}
            >
              Clear
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {searched ? (
          <p className="text-[13px] text-fg-muted">
            Semantic results for <span className="font-medium text-fg">“{searched}”</span>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {(['', ...KNOWLEDGE_TYPES] as const).map((t) => (
                <button
                  key={t || 'all'}
                  onClick={() => setTypeFilter(t)}
                  className={cx(
                    'h-7 rounded-full border px-3 text-[13px] transition',
                    typeFilter === t
                      ? 'border-transparent bg-fg text-canvas'
                      : 'border-line bg-surface text-fg-secondary hover:border-line-strong',
                  )}
                >
                  {t ? typeLabel(t) : 'All'}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Icon name="tag" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Filter by tag"
                className="input input-sm w-40 pl-8"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert>{error}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            icon="book"
            title={searched ? 'Nothing close to that' : 'No entries found'}
            description={searched ? 'Try different words — search matches meaning, not exact text.' : 'Capture a bug fix, a how-to or an insight.'}
            action={
              !searched && (
                <Link href="/knowledge/new" className="btn btn-primary btn-sm">
                  <Icon name="plus" /> New entry
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((k) => (
              <KnowledgeCard key={k.id} k={k} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<Loading />}>
      <KnowledgeList />
    </Suspense>
  );
}
