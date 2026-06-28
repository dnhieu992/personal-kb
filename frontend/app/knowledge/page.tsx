'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  api,
  Knowledge,
  KNOWLEDGE_TYPES,
  KnowledgeType,
  TYPE_COLORS,
} from '../lib/api';

function KnowledgeList() {
  const searchParams = useSearchParams();
  const initialTag = searchParams.get('tag') ?? '';

  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<KnowledgeType | ''>('');
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.list({
        type: typeFilter || undefined,
        tag: tagFilter || undefined,
      });
      setItems(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, tagFilter]);

  useEffect(() => {
    if (!searching) load();
  }, [load, searching]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setSearching(false);
      load();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.search(query.trim());
      setItems(data);
      setSearching(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setQuery('');
    setSearching(false);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this entry?')) return;
    await api.remove(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <Link
          href="/knowledge/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add entry
        </Link>
      </div>

      {/* Semantic search */}
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Semantic search (e.g. 'how did we speed up the orders API')"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Search
        </button>
        {searching && (
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {/* Filters (disabled while showing search results) */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => {
            setSearching(false);
            setTypeFilter(e.target.value as KnowledgeType | '');
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {KNOWLEDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={tagFilter}
          onChange={(e) => {
            setSearching(false);
            setTagFilter(e.target.value);
          }}
          placeholder="Filter by tag…"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        {searching && (
          <span className="text-sm text-slate-500">
            Showing semantic search results
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No entries found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((k) => (
            <div
              key={k.id}
              className="flex flex-col rounded-lg border bg-white p-4 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{k.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[k.type]}`}
                >
                  {k.type}
                </span>
              </div>
              {k.summary && (
                <p className="mt-1 text-sm text-slate-500">{k.summary}</p>
              )}
              {typeof k.score === 'number' && (
                <p className="mt-1 text-xs text-indigo-500">
                  similarity {k.score}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {(k.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-3 border-t pt-3 text-sm">
                <Link
                  href={`/knowledge/${k.id}/edit`}
                  className="text-indigo-600 hover:underline"
                >
                  Edit
                </Link>
                <button
                  onClick={() => onDelete(k.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <KnowledgeList />
    </Suspense>
  );
}
