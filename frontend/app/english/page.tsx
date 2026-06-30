import Link from 'next/link';
import {
  api,
  CEFR_LEVELS,
  EnglishStats,
  JournalWithItems,
  KIND_COLORS,
  KIND_LABELS,
  REVIEWABLE_KINDS,
  EnglishKind,
} from '../lib/api';

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
  let timeline: JournalWithItems[] = [];
  let error: string | null = null;
  try {
    [stats, timeline] = await Promise.all([
      api.english.stats(),
      api.english.journal(),
    ]);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Không kết nối được backend.</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const maxLevel = Math.max(1, ...Object.values(stats.byLevel));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nhật ký học tiếng Anh</h1>
          <p className="text-sm text-slate-500">
            Viết tự do mỗi ngày — AI rút ra mục cần ôn và theo dõi trình độ.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/english/review"
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Ôn tập{stats.dueForReview ? ` (${stats.dueForReview})` : ''}
          </Link>
          <Link
            href="/english/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Ghi nhật ký
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Buổi nhật ký" value={stats.journalCount} />
        <StatCard label="Mục cần nhớ" value={stats.itemCount} />
        <StatCard label="Chờ ôn" value={stats.dueForReview} />
        <StatCard label="Độ chính xác" value={`${stats.reviewAccuracy}%`} />
      </div>

      {stats.itemCount > 0 && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Level distribution */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Phân bố trình độ</h2>
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

          {/* Kind distribution */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Theo loại</h2>
            <div className="flex flex-wrap gap-2">
              {REVIEWABLE_KINDS.map((k) => (
                <span
                  key={k}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${KIND_COLORS[k]}`}
                >
                  {KIND_LABELS[k]} · {stats!.byKind[k] ?? 0}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Diary timeline */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Dòng thời gian</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có gì —{' '}
            <Link className="text-indigo-600 underline" href="/english/new">
              ghi buổi học đầu tiên
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            {timeline.map(({ journal, items }) => (
              <article key={journal.id} className="rounded-lg border bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <time className="text-xs font-medium text-slate-400">
                    {new Date(journal.createdAt).toLocaleString('vi-VN')}
                  </time>
                  <span className="text-xs text-slate-400">
                    {items.length} mục
                  </span>
                </div>
                <p className="text-slate-700">{journal.summary}</p>

                {journal.images && journal.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {journal.images.map((img) => (
                      <a
                        key={img.key}
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-square overflow-hidden rounded-md border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.name ?? ''}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t pt-3">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            KIND_COLORS[it.englishKind as EnglishKind]
                          }`}
                        >
                          {KIND_LABELS[it.englishKind as EnglishKind]}
                        </span>
                        <span>
                          <span className="font-medium">{it.content}</span>
                          {it.summary && (
                            <span className="text-slate-500"> — {it.summary}</span>
                          )}
                          {it.hard && (
                            <span className="ml-1 text-orange-600">★</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
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
