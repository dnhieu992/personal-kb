import Link from 'next/link';
import { api, CEFR_LEVELS, EnglishStats } from '../lib/api';

export const dynamic = 'force-dynamic';

const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-emerald-500',
  A2: 'bg-teal-500',
  B1: 'bg-sky-500',
  B2: 'bg-indigo-500',
  C1: 'bg-violet-500',
  C2: 'bg-fuchsia-500',
};

export default async function EnglishPage() {
  let stats: EnglishStats | null = null;
  let error: string | null = null;
  try {
    stats = await api.english.stats();
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Could not reach the backend.</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const maxLevel = Math.max(1, ...Object.values(stats.byLevel));
  const maxWeek = Math.max(1, ...stats.weekly.map((w) => w.count));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">English journey</h1>
          <p className="text-sm text-slate-500">
            Log sentences, review them, and watch your level grow.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/english/review"
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Review
          </Link>
          <Link
            href="/english/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add sentence
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sentences logged" value={stats.total} />
        <StatCard label="Due for review" value={stats.dueForReview} />
        <StatCard label="Review accuracy" value={`${stats.reviewAccuracy}%`} />
      </div>

      {stats.total === 0 ? (
        <p className="text-sm text-slate-500">
          No sentences yet —{' '}
          <Link className="text-indigo-600 underline" href="/english/new">
            add your first one
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Level distribution */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Level distribution</h2>
            <div className="space-y-2">
              {CEFR_LEVELS.map((lvl) => {
                const count = stats!.byLevel[lvl] ?? 0;
                return (
                  <div key={lvl} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-medium text-slate-600">
                      {lvl}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                      <div
                        className={`h-full ${LEVEL_COLORS[lvl]}`}
                        style={{ width: `${(count / maxLevel) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm text-slate-500">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weekly trend */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Last 7 days</h2>
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {stats.weekly.map((w) => (
                <div
                  key={w.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-xs text-slate-500">{w.count}</span>
                  <div
                    className="w-full rounded-t bg-indigo-500"
                    style={{ height: `${(w.count / maxWeek) * 90}px` }}
                  />
                  <span className="text-[10px] text-slate-400">
                    {w.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-indigo-700">{value}</p>
    </div>
  );
}
