'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  api,
  Exercise,
  Knowledge,
  KIND_COLORS,
  KIND_LABELS,
  EnglishKind,
  ReviewFocus,
  ReviewItem,
  WeakOverview,
  WeakPoint,
} from '@/features/english/api';
import { answerText, shuffle } from '@/features/english/course';
import { Icon } from '@/shared/ui/icons';
import { Alert, cx, Loading, PageHeader, ProgressBar } from '@/shared/ui/kit';
import { questionText, RunItem, RunResult, Runner, YourAnswer } from './runner';

type View =
  | { kind: 'hub' }
  | { kind: 'focus'; key: string }
  | { kind: 'test'; title: string; items: RunItem[]; finish: (r: RunResult[]) => Promise<ReactNode> };

/** A course exercise as a test question that reports back to the review schedule. */
function courseItem(it: ReviewItem): RunItem {
  return {
    id: `${it.lessonId}:${it.index}`,
    exercise: it.exercise,
    missed: it.missed,
    context: it.point ? `${it.point.vi || it.point.name}` : it.lessonTitle,
    grade: (text) => api.course.grade(it.lessonId, it.index, text),
  };
}

/**
 * Review = fixing what you get wrong. Mistakes from lessons are grouped by
 * grammar point; the weakest points come first; you study a point through its
 * common mistakes and your own wrong answers, then prove it in a short test.
 * Saved words are tested too (pick the right word), not self-rated.
 */
export default function ReviewPage() {
  const [view, setView] = useState<View>({ kind: 'hub' });
  const [weak, setWeak] = useState<WeakOverview | null>(null);
  const [cards, setCards] = useState<Knowledge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api.course.weak().then(setWeak).catch((e) => setError((e as Error).message));
    api.english.review(30).then(setCards).catch(() => setCards([]));
  }, []);
  useEffect(load, [load]);

  const back = () => {
    setView({ kind: 'hub' });
    load();
    window.scrollTo({ top: 0 });
  };

  /** Run course items, then record them and show what changed per point. */
  const runCourse = (title: string, items: ReviewItem[]) =>
    setView({
      kind: 'test',
      title,
      items: items.map(courseItem),
      finish: async (results) => {
        const r = await api.course.submitReview(
          results.map((x) => {
            const [lessonId, index] = x.item.id.split(':');
            return { lessonId, index: Number(index), correct: x.correct, answer: x.response as unknown as Record<string, unknown> };
          }),
        );
        return <CourseSummary correct={r.correct} total={r.total} points={r.points} />;
      },
    });

  async function startDaily() {
    setStarting(true);
    try {
      const { items } = await api.course.dailyReview();
      if (!items.length) setError('Chưa có gì để kiểm tra — học vài bài, các câu bạn làm sai sẽ được gom vào đây.');
      else runCourse('Kiểm tra ôn tập hôm nay', items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function startVocab() {
    if (!cards?.length) return;
    const items = vocabItems(cards);
    setView({
      kind: 'test',
      title: 'Kiểm tra từ vựng',
      items,
      finish: async (results) => {
        await Promise.all(results.map((r) => api.english.recordReview(r.item.id, r.correct).catch(() => null)));
        const right = results.filter((r) => r.correct).length;
        return (
          <ScoreCard
            correct={right}
            total={results.length}
            note="Từ trả lời đúng được giãn lịch ôn; từ sai sẽ quay lại sớm."
          />
        );
      },
    });
  }

  if (view.kind === 'test') {
    return (
      <Runner
        key={view.title + view.items.length}
        title={view.title}
        items={view.items}
        onFinish={view.finish}
        onExit={back}
        onRetry={(wrong) => setView({ ...view, title: `${view.title} · làm lại`, items: wrong })}
      />
    );
  }

  if (view.kind === 'focus') {
    return (
      <Focus
        pointKey={view.key}
        onBack={back}
        onTest={(f) => runCourse(`Ôn: ${f.point.vi || f.point.name}`, f.test)}
      />
    );
  }

  if (error && !weak) return <Alert>{error}</Alert>;
  if (!weak) return <Loading label="Đang xem bạn hay sai ở đâu…" />;

  const top = weak.points.slice(0, 12);
  const cardsDue = cards?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ôn tập"
        description="Tập trung vào chỗ bạn hay sai: mỗi câu làm sai trong bài học quay lại theo lịch 1 → 3 → 7 ngày, đúng 3 lần liên tiếp là khắc phục xong."
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Câu sai cần ôn hôm nay" value={weak.due} tone={weak.due ? 'danger' : 'default'} icon="alert" />
        <Stat label="Câu sai đang theo dõi" value={weak.open} icon="clock" />
        <Stat label="Đã khắc phục" value={weak.resolved} tone="success" icon="check" />
        <Stat label="Thẻ từ đến hạn" value={cardsDue} tone={cardsDue ? 'warning' : 'default'} icon="cards" />
      </div>

      {/* Today's test */}
      <section className="card flex flex-wrap items-center gap-4 border-accent/30 bg-accent-soft/40 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          <Icon name="target" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">Bài kiểm tra ôn tập hôm nay</p>
          <p className="mt-0.5 text-sm text-fg-muted">
            Tối đa 15 câu: các câu bạn từng sai đến hạn ôn, cộng câu mới cùng điểm ngữ pháp yếu nhất. Chấm tự động.
          </p>
        </div>
        <button onClick={startDaily} disabled={starting} className="btn btn-primary">
          <Icon name="play" /> {starting ? 'Đang chuẩn bị…' : 'Bắt đầu'}
        </button>
      </section>

      {/* Weak points */}
      <section className="card overflow-hidden">
        <header className="border-b border-line p-4">
          <h2 className="text-[15px] font-semibold text-fg">Điểm yếu nhất</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Gom theo điểm ngữ pháp từ mọi lần bạn làm bài (và từ test xếp lớp). Bấm để xem lỗi hay gặp, câu bạn đã sai và
            làm bài kiểm tra ngắn cho riêng điểm đó.
          </p>
        </header>
        {top.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-muted">
            Chưa có lỗi nào được ghi lại. Làm bài luyện tập trong{' '}
            <Link href="/english" className="link">
              khóa học
            </Link>{' '}
            — câu nào sai sẽ xuất hiện ở đây.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {top.map((p) => (
              <WeakRow key={p.key} point={p} onOpen={() => setView({ kind: 'focus', key: p.key })} />
            ))}
          </ul>
        )}
      </section>

      {/* Saved words */}
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-fg">Từ vựng & lỗi khi viết</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Từ của các bài học, tech note, entry, task. Kiểm tra bằng trắc nghiệm: đọc nghĩa, chọn đúng từ/cụm từ tiếng
            Anh.
          </p>
          {!!cards?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cards.slice(0, 8).map((c) => (
                <span key={c.id} className={cx('chip', c.englishKind ? KIND_COLORS[c.englishKind as EnglishKind] : 'tone-gray')}>
                  {c.content.length > 32 ? `${c.content.slice(0, 30)}…` : c.content}
                </span>
              ))}
              {cards.length > 8 && <span className="text-xs text-fg-subtle">+{cards.length - 8}</span>}
            </div>
          )}
        </div>
        <button onClick={startVocab} disabled={!cardsDue} className="btn btn-secondary">
          <Icon name="cards" /> {cardsDue ? `Kiểm tra ${cardsDue} từ` : 'Không có từ đến hạn'}
        </button>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: 'alert' | 'clock' | 'check' | 'cards';
  tone?: 'default' | 'danger' | 'success' | 'warning';
}) {
  const cls = {
    default: 'bg-muted text-fg-muted',
    danger: 'bg-danger-soft text-danger-text',
    success: 'bg-success-soft text-success-text',
    warning: 'bg-warning-soft text-warning-text',
  }[tone];
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cls)}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[22px] font-semibold leading-none tabular-nums text-fg">{value}</p>
        <p className="mt-1 truncate text-xs text-fg-muted">{label}</p>
      </div>
    </div>
  );
}

function WeakRow({ point: p, onOpen }: { point: WeakPoint; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-subtle">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {p.vi || p.name}
            {p.level && <span className="ml-2 text-xs font-normal text-fg-subtle">{p.level}</span>}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {p.name}
            {p.lessons.length > 0 && ` · ${p.lessons.length} bài`}
          </p>
        </div>
        <div className="hidden w-40 shrink-0 sm:block">
          {p.accuracy !== null ? (
            <>
              <div className="mb-1 flex justify-between text-xs text-fg-muted">
                <span>Đúng</span>
                <span className="tabular-nums">{p.accuracy}%</span>
              </div>
              <ProgressBar value={p.accuracy / 100} tone={p.accuracy >= 80 ? 'success' : 'accent'} />
            </>
          ) : (
            <span className="text-xs text-fg-subtle">Chưa làm bài</span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1 sm:w-52">
          {p.due > 0 && <span className="chip tone-red">{p.due} cần ôn</span>}
          {p.wrong > 0 && <span className="chip tone-gray">sai {p.wrong} lần</span>}
          {p.placement && <span className="chip tone-amber">test xếp lớp</span>}
        </div>
        <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-fg-faint" />
      </button>
    </li>
  );
}

/** One weak point: what people get wrong, what YOU got wrong, then a test. */
function Focus({ pointKey, onBack, onTest }: { pointKey: string; onBack: () => void; onTest: (f: ReviewFocus) => void }) {
  const [data, setData] = useState<ReviewFocus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.course.reviewFocus(pointKey).then(setData).catch((e) => setError((e as Error).message));
  }, [pointKey]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading label="Đang gom lỗi của bạn…" />;

  const open = data.mistakes.filter((m) => !m.resolved);
  const testButton = (
    <button onClick={() => onTest(data)} disabled={!data.test.length} className="btn btn-primary">
      <Icon name="play" /> Kiểm tra {data.test.length} câu
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="btn btn-ghost btn-sm -ml-2 mb-2">
          <Icon name="chevron-left" /> Ôn tập
        </button>
        <PageHeader
          title={data.point.vi || data.point.name}
          description={`${data.point.level ? `${data.point.level} · ` : ''}${data.point.name}`}
          actions={testButton}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="section-title">Lỗi hay gặp</h2>
          {data.tips.length ? (
            data.tips.map((t) => (
              <article key={t.lessonId} className="card p-5">
                <p className="eyebrow mb-2">
                  Từ bài{' '}
                  <Link href={`/english/lesson/${t.lessonId}`} className="link normal-case">
                    {t.lessonTitle}
                  </Link>
                </p>
                <div className="prose-kb text-[14.5px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.markdown}</ReactMarkdown>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-fg-muted">Bài học của điểm này chưa có phần “Lỗi hay gặp”.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="section-title">
            Câu bạn đã làm sai{' '}
            <span className="font-normal text-fg-muted">
              ({open.length} chưa khắc phục{data.mistakes.length > open.length ? `, ${data.mistakes.length - open.length} đã xong` : ''})
            </span>
          </h2>
          {data.mistakes.length ? (
            <ul className="space-y-2">
              {data.mistakes.map((m) => (
                <li key={`${m.lessonId}:${m.index}`} className={cx('card p-4 text-sm', m.resolved && 'opacity-60')}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                    <span>{m.lessonTitle}</span>
                    <span className="chip tone-gray">sai {m.wrong} lần</span>
                    {m.resolved && <span className="chip tone-green">đã khắc phục</span>}
                  </div>
                  {m.exercise.type === 'read' && m.exercise.passage && (
                    <p className="mb-1 line-clamp-3 text-xs text-fg-muted">{m.exercise.passage}</p>
                  )}
                  <p className="text-fg">{questionText(m.exercise)}</p>
                  <YourAnswer response={m.answer} />
                  <p className="mt-1 font-medium text-success-text">✓ {answerText(m.exercise)}</p>
                  {m.exercise.explanation && <p className="mt-1 text-fg-secondary">{m.exercise.explanation}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card p-4 text-sm text-fg-muted">
              Chưa có câu sai nào được ghi lại cho điểm này
              {data.point ? ' (điểm yếu từ test xếp lớp)' : ''} — làm bài kiểm tra để xem bạn đã vững chưa.
            </p>
          )}
        </section>
      </div>

      <div className="flex justify-end">{testButton}</div>
    </div>
  );
}

function ScoreCard({ correct, total, note, children }: { correct: number; total: number; note?: string; children?: ReactNode }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cx(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            pct >= 80 ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text',
          )}
        >
          <Icon name={pct >= 80 ? 'check' : 'refresh'} className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-[32px] font-semibold leading-none tabular-nums text-fg">{pct}%</p>
          <p className="mt-1 text-sm text-fg-muted">
            Đúng {correct}/{total} câu{note ? ` · ${note}` : ''}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function CourseSummary({ correct, total, points }: { correct: number; total: number; points: WeakPoint[] }) {
  return (
    <ScoreCard correct={correct} total={total} note="Câu sai quay lại vào ngày mai; câu đúng được giãn lịch.">
      {points.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Điểm ngữ pháp sau bài này</p>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p.key} className="text-sm">
                <div className="mb-1 flex justify-between gap-2">
                  <span className="truncate text-fg">{p.vi || p.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">
                    {p.accuracy ?? '—'}%{p.open ? ` · còn ${p.open} câu` : ' · đã vững'}
                  </span>
                </div>
                <ProgressBar value={(p.accuracy ?? 0) / 100} tone={(p.accuracy ?? 0) >= 80 && !p.open ? 'success' : 'accent'} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </ScoreCard>
  );
}

/** Saved words → "pick the English for this meaning" (typed when there are too few to choose from). */
function vocabItems(cards: Knowledge[]): RunItem[] {
  return shuffle(cards).map((c) => {
    const others = shuffle(cards.filter((o) => o.id !== c.id && o.content !== c.content));
    const sameKind = others.filter((o) => o.englishKind === c.englishKind);
    const distractors = [...sameKind, ...others.filter((o) => !sameKind.includes(o))]
      .map((o) => o.content)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    const meaning = c.summary || '';
    const kind = c.englishKind ? KIND_LABELS[c.englishKind as EnglishKind] : 'Từ';
    const exercise: Exercise =
      distractors.length >= 2
        ? {
            type: 'mcq',
            prompt: `Chọn ${kind.toLowerCase()} đúng với nghĩa: ${meaning}`,
            options: [c.content, ...distractors],
            answer: [c.content],
            pairs: [],
            explanation: '',
          }
        : {
            type: 'gap',
            prompt: `${meaning} → ___`,
            options: [],
            answer: [c.content],
            pairs: [],
            explanation: '',
          };
    return { id: c.id, exercise, context: kind };
  });
}
