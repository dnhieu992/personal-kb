'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, COURSE_LEVELS, CourseLevel, Journey } from '../lib/api';
import { Icon } from '../components/icons';
import { cx, ProgressBar } from '../components/ui';

export const LEVEL_NOTE: Record<CourseLevel, string> = {
  A2: 'Nền tảng',
  B1: 'Giao tiếp công việc',
  B2: 'Làm việc độc lập',
  C1: 'Thành thạo',
};

const PACES = [3, 5, 7, 10];

/** "khoảng 32 giờ" / "khoảng 45 phút". */
export function studyTime(minutes: number) {
  if (minutes < 90) return `${minutes} phút`;
  return `${Math.round(minutes / 60)} giờ`;
}

function etaLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const weeks = Math.max(1, Math.round((d.getTime() - Date.now()) / (7 * 86_400_000)));
  return { month: `tháng ${d.getMonth() + 1}/${d.getFullYear()}`, weeks };
}

/**
 * The whole way to the goal: one bar from the start level to the finish flag,
 * split by level, plus this week's pace, the streak and when you'll get there.
 */
export function JourneyCard({ journey: j, onChange }: { journey: Journey; onChange: (j: Journey) => void }) {
  const [editing, setEditing] = useState(false);
  const atGoal = etaLabel(j.etaAtGoal);
  const atPace = etaLabel(j.etaAtPace);
  const finished = j.total > 0 && j.done >= j.total;
  const weekShare = Math.min(1, j.last7 / j.weeklyLessons);
  const next = j.next && j.next.status === 'READY' && !j.next.locked ? j.next : null;

  return (
    <section className="card overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Hành trình của bạn</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[32px] font-semibold leading-none tabular-nums text-fg">{j.pct}%</span>
              <span className="text-[15px] font-medium text-fg">
                {j.start === j.target ? `Hoàn thành ${j.target}` : `${j.start} → ${j.target}`}
              </span>
            </p>
            <p className="mt-1.5 text-[13px] text-fg-muted">
              {finished
                ? 'Bạn đã về đích — đặt mục tiêu mới để đi tiếp.'
                : `${j.done}/${j.total} bài · còn khoảng ${studyTime(j.minutesLeft)} học`}
            </p>
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className={cx('btn btn-sm', editing ? 'btn-secondary' : 'btn-ghost')}
            aria-expanded={editing}
          >
            <Icon name="settings" /> {j.goalSet ? 'Mục tiêu' : 'Đặt mục tiêu'}
          </button>
        </div>

        {editing && (
          <GoalEditor
            journey={j}
            onSaved={(next) => {
              onChange(next);
              setEditing(false);
            }}
          />
        )}

        {/* The road: one segment per level, sized by its lessons, finish flag at the end. */}
        <div className="mt-5 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1">
            {j.levels.map((l) => {
              const share = l.total ? l.done / l.total : 0;
              return (
                <div key={l.level} className="min-w-0" style={{ flexGrow: Math.max(1, l.total), flexBasis: 0 }}>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-emphasis"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={l.total}
                    aria-valuenow={l.done}
                    aria-label={`${l.level}: ${l.done}/${l.total} bài`}
                  >
                    <div
                      className={cx('h-full rounded-full transition-all', share >= 1 ? 'bg-success' : 'bg-accent')}
                      style={{ width: `${Math.round(share * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-fg">
                      <span className="font-semibold">{l.level}</span>
                      <span className="hidden text-fg-muted sm:inline"> · {LEVEL_NOTE[l.level]}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg-muted" title={l.estimated ? 'Level chưa soạn đủ — tính theo số bài dự kiến' : undefined}>
                      {l.done}/{l.total}
                      {l.estimated && '*'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <span
            className={cx(
              '-mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              finished ? 'bg-success text-white' : 'bg-muted text-fg-muted',
            )}
            title={`Đích: hết ${j.target}`}
          >
            <Icon name="flag" className="h-3.5 w-3.5" />
          </span>
        </div>
        {j.levels.some((l) => l.estimated) && (
          <p className="mt-1 text-[11px] text-fg-subtle">* Level chưa soạn đủ — tính theo số bài dự kiến, % không bị tụt khi có bài mới.</p>
        )}
      </div>

      {/* Pace */}
      <div className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-3.5">
          <p className="text-xs text-fg-muted">7 ngày qua</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-fg">
            {j.last7}/{j.weeklyLessons} bài
            {j.last7 >= j.weeklyLessons && <span className="ml-1.5 chip tone-green">Đạt mục tiêu</span>}
          </p>
          <ProgressBar value={weekShare} tone={weekShare >= 1 ? 'success' : 'accent'} className="mt-2" />
        </div>
        <div className="px-5 py-3.5">
          <p className="text-xs text-fg-muted">Chuỗi ngày học</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-fg">
            <Icon name="flame" className={cx('h-4 w-4', j.streak ? 'text-warning-text' : 'text-fg-faint')} />
            {j.streak} ngày
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            {j.studiedToday ? 'Hôm nay đã học ✓' : j.streak ? 'Học 1 bài hôm nay để giữ chuỗi' : 'Học 1 bài hôm nay để bắt đầu chuỗi'}
          </p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-xs text-fg-muted">Về đích dự kiến</p>
          {finished ? (
            <p className="mt-0.5 text-[15px] font-semibold text-success-text">Đã về đích</p>
          ) : (
            <>
              <p className="mt-0.5 text-[15px] font-semibold text-fg">{atGoal ? atGoal.month : '—'}</p>
              <p className="mt-1 text-xs text-fg-subtle">
                {atGoal && `~${atGoal.weeks} tuần với ${j.weeklyLessons} bài/tuần`}
                {atPace && j.pace !== j.weeklyLessons && (
                  <>
                    <br />
                    Nhịp 4 tuần qua ({j.pace} bài/tuần): {atPace.month}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {next && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-accent-soft/40 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-muted">
              {next.mastery === 'weak' ? 'Ưu tiên củng cố' : next.kind === 'REVIEW' ? 'Ôn tập cuối unit' : 'Bài tiếp theo'} · {next.level}
            </p>
            <p className="truncate text-sm font-medium text-fg">{next.title}</p>
          </div>
          <Link href={`/english/lesson/${next.id}`} className="btn btn-primary w-full sm:w-auto">
            <Icon name="play" /> {j.done ? 'Học tiếp' : 'Bắt đầu'}
          </Link>
        </div>
      )}
    </section>
  );
}

function GoalEditor({ journey: j, onSaved }: { journey: Journey; onSaved: (j: Journey) => void }) {
  const [start, setStart] = useState<CourseLevel>(j.start);
  const [target, setTarget] = useState<CourseLevel>(j.target);
  const [weekly, setWeekly] = useState(j.weeklyLessons);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = COURSE_LEVELS.indexOf(start);

  async function save() {
    setSaving(true);
    try {
      onSaved(await api.course.setGoal({ startLevel: start, targetLevel: target, weeklyLessons: weekly }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const choice = (active: boolean) =>
    cx('btn btn-sm min-w-[3rem] justify-center', active ? 'btn-primary' : 'btn-secondary');

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-line bg-subtle p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Bắt đầu từ</p>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_LEVELS.map((l) => (
              <button
                key={l}
                className={choice(start === l)}
                onClick={() => {
                  setStart(l);
                  if (COURSE_LEVELS.indexOf(target) < COURSE_LEVELS.indexOf(l)) setTarget(l);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Đích: học xong</p>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_LEVELS.map((l, i) => (
              <button key={l} className={choice(target === l)} disabled={i < from} onClick={() => setTarget(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Số bài mỗi tuần</p>
          <div className="flex flex-wrap gap-1.5">
            {PACES.map((n) => (
              <button key={n} className={choice(weekly === n)} onClick={() => setWeekly(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-fg-muted">
        Mỗi bài khoảng 15 phút. {weekly} bài/tuần ≈ {Math.round((weekly * 15) / 7)} phút mỗi ngày.
      </p>
      {error && <p className="text-xs text-danger-text">{error}</p>}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          <Icon name="check" /> {saving ? 'Đang lưu…' : 'Lưu mục tiêu'}
        </button>
      </div>
    </div>
  );
}

/** A slim version for the lesson page: where this lesson sits on the way. */
export function JourneyStrip({ journey: j }: { journey: Journey }) {
  return (
    <Link href="/english" className="mb-5 flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-xs hover:bg-subtle">
      <span className="shrink-0 font-medium text-fg">
        {j.start === j.target ? j.target : `${j.start} → ${j.target}`}
      </span>
      <ProgressBar value={j.total ? j.done / j.total : 0} className="flex-1" />
      <span className="shrink-0 tabular-nums text-fg-muted">
        {j.pct}% · {j.done}/{j.total}
      </span>
      {j.streak > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-fg-muted">
          <Icon name="flame" className="h-3.5 w-3.5 text-warning-text" />
          {j.streak}
        </span>
      )}
    </Link>
  );
}
