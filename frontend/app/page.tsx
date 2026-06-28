import Link from 'next/link';
import { api, TYPE_COLORS, Stats } from './lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let stats: Stats | null = null;
  let error: string | null = null;
  try {
    stats = await api.stats();
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Could not reach the backend.</p>
        <p className="mt-1 text-sm">{error}</p>
        <p className="mt-2 text-sm">
          Make sure the backend is running on{' '}
          <code>http://localhost:3001</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/knowledge/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Quick add
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total entries" value={stats.total} />
        <StatCard label="Added today" value={stats.today} />
        <StatCard label="Unique tags" value={stats.popularTags.length} />
      </div>

      {/* Popular tags */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Popular tags</h2>
        {stats.popularTags.length === 0 ? (
          <p className="text-sm text-slate-500">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.popularTags.map((t) => (
              <Link
                key={t.tag}
                href={`/knowledge?tag=${encodeURIComponent(t.tag)}`}
                className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-300"
              >
                #{t.tag} <span className="text-slate-500">{t.count}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent entries */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent entries</h2>
        <div className="space-y-3">
          {stats.recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing yet — <Link className="text-indigo-600 underline" href="/knowledge/new">add your first entry</Link>.
            </p>
          ) : (
            stats.recent.map((k) => (
              <Link
                key={k.id}
                href={`/knowledge/${k.id}/edit`}
                className="block rounded-lg border bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{k.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[k.type]}`}
                  >
                    {k.type}
                  </span>
                </div>
                {k.summary && (
                  <p className="mt-1 text-sm text-slate-500">{k.summary}</p>
                )}
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-indigo-700">{value}</p>
    </div>
  );
}
