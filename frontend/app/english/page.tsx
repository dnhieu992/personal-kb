'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  COURSE_LEVELS,
  CourseLevel,
  CourseFramework,
  CourseOverview,
  LessonSummary,
} from '../lib/api';
import { Icon } from '../components/icons';
import { Alert, cx, EmptyState, Loading, PageHeader, ProgressBar, StatCard } from '../components/ui';

const LEVEL_NOTE: Record<CourseLevel, string> = {
  A2: 'Nền tảng',
  B1: 'Giao tiếp công việc',
  B2: 'Làm việc độc lập',
  C1: 'Thành thạo',
};

function CoursePage() {
  const params = useSearchParams();
  const router = useRouter();
  const level = (params.get('level') as CourseLevel) || undefined;

  const [data, setData] = useState<CourseOverview | null>(null);
  const [due, setDue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api.course
      .overview(level)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [level]);

  useEffect(() => {
    load();
    api.english.stats().then((s) => setDue(s.dueForReview)).catch(() => {});
  }, [load]);

  const current = data?.levels.find((l) => l.level === data.level);
  const generating = !!current?.generating;

  // While a level is being written, refresh so lessons appear as they land.
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [generating, load]);

  async function generate() {
    if (!data) return;
    setStarting(true);
    try {
      const r = await api.course.generate(data.level);
      if (!r.enabled) setError('Backend chưa có ANTHROPIC_API_KEY nên không sinh được nội dung.');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (error && !data) return <Alert title="Không tải được khóa học.">{error}</Alert>;
  if (!data || !current) return <Loading label="Đang tải khóa học…" />;

  const { progress, next } = data;
  const pending = generating ? 0 : current.total - current.ready - current.failed;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="English for IT"
        description="Lộ trình tiếng Anh đi làm theo CEFR — học lý thuyết, luyện tập, qua bài mới mở bài kế."
        actions={
          <>
            <Link href="/english/placement" className="btn btn-secondary">
              <Icon name="target" /> Test xếp lớp
            </Link>
            <Link href="/english/review" className="btn btn-secondary">
              <Icon name="cards" /> Ôn thẻ
              {!!due && <span className="chip tone-amber -mr-1 px-1.5">{due}</span>}
            </Link>
            <Link href="/english/journal" className="btn btn-secondary">
              <Icon name="pen" /> Nhật ký
            </Link>
          </>
        }
      />

      {error && <Alert>{error}</Alert>}

      {data.placement ? (
        <Link href="/english/placement" className="card card-interactive flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <Icon name="target" className="h-4 w-4 text-accent-text" />
          <span className="text-fg">
            Kết quả xếp lớp: <span className="font-semibold">{data.placement.placedLevel}</span>
          </span>
          {data.placement.inAppTaken && (
            <span className="text-fg-muted">
              đúng {data.placement.score}% · {data.placement.weakPoints.length} điểm cần củng cố ·{' '}
              {data.placement.masteredPoints.length} điểm đã vững
            </span>
          )}
          {data.placement.efsetLevel && (
            <span className="text-fg-muted">
              EF SET {data.placement.efsetScore} → {data.placement.efsetLevel}
            </span>
          )}
          <span className="ml-auto text-xs text-fg-subtle">Xem chi tiết / làm lại</span>
        </Link>
      ) : (
        <section className="card flex flex-wrap items-center gap-4 border-accent/30 bg-accent-soft/40 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Icon name="target" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">Bắt đầu bằng bài test xếp lớp</p>
            <p className="mt-0.5 text-sm text-fg-muted">
              48 câu (ngữ pháp, từ vựng, đọc, nghe) theo khung CEFR, khoảng 20 phút. App sẽ chọn level cho bạn, cho bỏ qua
              phần đã vững và đưa điểm yếu lên học trước.
            </p>
          </div>
          <Link href="/english/placement" className="btn btn-primary">
            <Icon name="play" /> Làm test
          </Link>
        </section>
      )}

      {/* Level picker */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.levels.map((l) => {
          const active = l.level === data.level;
          return (
            <button
              key={l.level}
              onClick={() => router.replace(`/english?level=${l.level}`)}
              className={cx(
                'card p-3 text-left transition',
                active ? 'border-accent ring-1 ring-accent' : 'card-interactive',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-base font-semibold text-fg">
                  {l.level}
                  {data.placement?.placedLevel === l.level && <span className="chip tone-accent">level của bạn</span>}
                </span>
                <span className="text-xs tabular-nums text-fg-muted">
                  {l.total ? `${l.done}/${l.total}` : l.generating ? 'đang soạn' : 'chưa có'}
                </span>
              </div>
              <p className="mb-2 text-xs text-fg-muted">{LEVEL_NOTE[l.level]}</p>
              <ProgressBar value={l.total ? l.done / l.total : 0} tone={l.total && l.done === l.total ? 'success' : 'accent'} />
            </button>
          );
        })}
      </div>

      {current.total === 0 ? (
        generating ? (
          <div className="card p-6">
            <Loading label={`Đang soạn khung chương trình ${data.level} (8 unit × 4 bài)… khoảng 1–2 phút.`} />
          </div>
        ) : (
          <EmptyState
            icon="graduation"
            title={`Chưa có nội dung cho level ${data.level}`}
            description="AI sẽ soạn 8 unit × 4 bài (lý thuyết, từ vựng, bài tập) theo bối cảnh công việc IT. Mất khoảng 10–15 phút, chạy nền — bạn học được ngay khi bài đầu tiên xong."
            action={
              <button onClick={generate} disabled={starting} className="btn btn-primary">
                <Icon name="sparkles" /> {starting ? 'Đang bắt đầu…' : `Soạn giáo trình ${data.level}`}
              </button>
            }
          />
        )
      ) : (
        <>
          {(generating || current.failed > 0 || pending > 0) && (
            <div className="card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">
                  {generating
                    ? `Đang soạn bài: ${current.ready}/${current.total}`
                    : [current.failed > 0 && `${current.failed} bài soạn bị lỗi`, pending > 0 && `${pending} bài chưa soạn`]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
                <ProgressBar value={current.total ? current.ready / current.total : 0} className="mt-2" />
              </div>
              {!generating && (
                <button onClick={generate} disabled={starting} className="btn btn-secondary btn-sm">
                  <Icon name="refresh" /> {pending > 0 ? 'Soạn bài còn thiếu' : 'Soạn lại bài lỗi'}
                </button>
              )}
            </div>
          )}
          {current.error && <Alert title="Soạn giáo trình bị dừng">{current.error}</Alert>}

          {/* Progress hero */}
          <section className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Tiến độ {data.level}</p>
                <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-fg">
                  {pct}%
                  <span className="ml-2 text-sm font-normal text-fg-muted">
                    {progress.done}/{progress.total} bài
                  </span>
                </p>
              </div>
              {next && next.status === 'READY' && !next.locked && (
                <Link href={`/english/lesson/${next.id}`} className="btn btn-primary">
                  <Icon name="play" /> {next.mastery === 'weak' ? 'Củng cố' : progress.done ? 'Học tiếp' : 'Bắt đầu'}: {next.title}
                </Link>
              )}
              {!next && progress.total > 0 && (
                <span className="chip tone-green px-2.5 py-1 text-[13px]">
                  <Icon name="check" className="h-3.5 w-3.5" /> Hoàn thành {data.level}
                </span>
              )}
            </div>
            <ProgressBar value={pct / 100} className="mt-4 h-2.5" tone={pct === 100 ? 'success' : 'accent'} />
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Bài đã xong" value={progress.done} icon="check" tone="success" />
            <StatCard label="Điểm trung bình" value={data.averageScore === null ? '—' : `${data.averageScore}%`} icon="target" hint={`Cần ≥ ${data.passScore}% để qua bài`} />
            <StatCard label="Từ vựng đã học" value={data.vocabLearned} icon="book" hint="Đã vào hàng đợi ôn thẻ" />
            <StatCard label="Thẻ chờ ôn" value={due ?? '—'} icon="cards" tone={due ? 'warning' : 'default'} href="/english/review" />
          </div>

          {data.focus.length > 0 && (
            <section className="card overflow-hidden">
              <header className="border-b border-line p-4">
                <p className="eyebrow">Theo kết quả test xếp lớp</p>
                <h2 className="text-[15px] font-semibold text-fg">Ưu tiên củng cố</h2>
                <p className="mt-0.5 text-[13px] text-fg-muted">
                  Bạn làm sai điểm ngữ pháp của các bài này trong bài test, nên chúng được mở sẵn — học trước, không cần
                  đi lần lượt.
                </p>
              </header>
              <ul className="divide-y divide-line">
                {data.focus.map((l) => (
                  <LessonRow key={l.id} lesson={l} isNext={next?.id === l.id} generating={generating} />
                ))}
              </ul>
            </section>
          )}

          {/* Units */}
          <div className="space-y-4">
            {data.units.map((unit) => {
              const done = unit.lessons.filter((l) => l.completedAt).length;
              return (
                <section key={unit.id} className="card overflow-hidden">
                  <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line p-4">
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow">Unit {unit.position}</p>
                      <h2 className="text-[15px] font-semibold text-fg">
                        {unit.title} <span className="font-normal text-fg-muted">· {unit.titleVi}</span>
                      </h2>
                      <p className="mt-0.5 text-[13px] text-fg-muted">{unit.summary}</p>
                    </div>
                    <div className="w-full sm:w-40">
                      <div className="mb-1 flex justify-between text-xs text-fg-muted">
                        <span>Tiến độ</span>
                        <span className="tabular-nums">{done}/{unit.lessons.length}</span>
                      </div>
                      <ProgressBar value={unit.lessons.length ? done / unit.lessons.length : 0} tone={done === unit.lessons.length ? 'success' : 'accent'} />
                    </div>
                  </header>
                  <ul className="divide-y divide-line">
                    {unit.lessons.map((l) => (
                      <LessonRow key={l.id} lesson={l} isNext={next?.id === l.id} generating={generating} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {data.framework && <Framework level={data.level} framework={data.framework} />}
        </>
      )}
    </div>
  );
}

function LessonRow({ lesson: l, isNext, generating }: { lesson: LessonSummary; isNext: boolean; generating: boolean }) {
  const open = l.status === 'READY' && !l.locked;
  const icon = l.completedAt ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success-text">
      <Icon name="check" className="h-4 w-4" strokeWidth={2.25} />
    </span>
  ) : l.status === 'FAILED' ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger-soft text-danger-text">
      <Icon name="alert" className="h-3.5 w-3.5" />
    </span>
  ) : l.status === 'PENDING' && !generating ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-emphasis text-fg-faint">
      <Icon name="clock" className="h-3.5 w-3.5" />
    </span>
  ) : l.status !== 'READY' ? (
    <span className="flex h-7 w-7 items-center justify-center">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emphasis border-t-accent" />
    </span>
  ) : l.locked ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-fg-faint">
      <Icon name="lock" className="h-3.5 w-3.5" />
    </span>
  ) : (
    <span className={cx('flex h-7 w-7 items-center justify-center rounded-full', isNext ? 'bg-accent text-accent-fg' : 'bg-accent-soft text-accent-text')}>
      <Icon name="play" className="h-3 w-3" />
    </span>
  );

  const body = (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-sm font-medium', l.locked && !l.completedAt ? 'text-fg-muted' : 'text-fg')}>
          {l.position}. {l.title}
        </p>
        <p className="truncate text-xs text-fg-muted">
          {l.grammar} · {l.vocabTheme}
        </p>
      </div>
      {l.mastery && !l.completedAt && (
        <span className={cx('chip shrink-0', l.mastery === 'weak' ? 'tone-amber' : 'tone-green')}>
          {l.mastery === 'weak' ? 'Cần củng cố' : 'Đã vững'}
        </span>
      )}
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {l.bestScore !== null && (
          <span className={cx('chip', l.completedAt ? 'tone-green' : 'tone-amber')}>{l.bestScore}%</span>
        )}
        <span className="text-xs tabular-nums text-fg-subtle">
          <Icon name="clock" className="mr-1 inline h-3 w-3" />
          {l.minutes}′
        </span>
      </div>
      {open && <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-fg-faint" />}
    </div>
  );

  return (
    <li className={cx(isNext && 'bg-accent-soft/40')}>
      {open || l.completedAt ? (
        <Link href={`/english/lesson/${l.id}`} className="block hover:bg-subtle">
          {body}
        </Link>
      ) : (
        <div title={l.locked ? 'Hoàn thành bài trước để mở' : l.status === 'PENDING' && !generating ? 'Chưa soạn' : 'Đang soạn…'}>{body}</div>
      )}
    </li>
  );
}

/** The reference syllabus for the level and how much of it the lessons cover. */
function Framework({ level, framework: f }: { level: CourseLevel; framework: CourseFramework }) {
  const covered = f.points.filter((p) => p.lessonIds.length).length;
  const done = f.points.filter((p) => p.done).length;
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Khung chuẩn {level}</p>
          <h2 className="text-[15px] font-semibold text-fg">
            British Council – EAQUALS Core Inventory{' '}
            <span className="font-normal text-fg-muted">
              · {covered}/{f.points.length} điểm có bài · {done} điểm đã học xong
            </span>
          </h2>
        </div>
        <span className="text-xs text-fg-subtle">
          CEFR {level} ≈ GSE {f.gse} ≈ EF SET {f.efset}
        </span>
        <Icon name="chevron-right" className="h-4 w-4 text-fg-faint transition group-open:rotate-90" />
      </summary>
      <div className="space-y-5 border-t border-line p-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Ngữ pháp & từ nối</p>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {f.points.map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-[13px]">
                <Icon
                  name={p.done ? 'check' : p.lessonIds.length ? 'book' : 'clock'}
                  className={cx('mt-0.5 h-3.5 w-3.5 shrink-0', p.done ? 'text-success-text' : p.lessonIds.length ? 'text-fg-muted' : 'text-fg-faint')}
                />
                <span className={p.lessonIds.length ? 'text-fg' : 'text-fg-subtle'}>
                  {p.name} <span className="text-fg-muted">· {p.vi}</span>
                  {!p.lessonIds.length && <span className="text-fg-subtle"> (chưa có bài)</span>}
                </span>
              </li>
            ))}
          </ul>
          {f.extra.length > 0 && (
            <p className="mt-2 text-xs text-fg-muted">
              Ôn lại từ level khác: {f.extra.map((p) => `${p.level} ${p.vi}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Mục tiêu công việc</p>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-fg">
              {f.canDo.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Chức năng giao tiếp</p>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-fg">
              {f.functions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Nguồn</p>
          <ul className="space-y-1 text-xs text-fg-muted">
            {f.sources.map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-accent-text hover:underline">
                  {s.name}
                </a>{' '}
                — {s.use}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <CoursePage />
    </Suspense>
  );
}
