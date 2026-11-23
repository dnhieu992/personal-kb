'use client';

import { ReactNode, useEffect, useState } from 'react';
import type { Exercise, WritingGrade } from '../../lib/api';
import { answerText, isCorrect, Response, speak } from '../../lib/course';
import { Icon } from '../../components/icons';
import { Alert, cx, ProgressBar } from '../../components/ui';
import { answered, blank, ExerciseView, hintOf, SKILL_TONE, TYPE_LABEL } from '../lesson/[id]/practice';

/** One question of a review test. */
export interface RunItem {
  id: string;
  exercise: Exercise;
  /** Shown above the question: which point / lesson it comes from. */
  context?: string;
  /** A mistake you made before (vs a fresh question). */
  missed?: boolean;
  /** Needed for `write` items: grades the text on the server. */
  grade?: (text: string) => Promise<WritingGrade>;
}

export interface RunResult {
  item: RunItem;
  correct: boolean;
  response: Response;
}

/**
 * Runs a list of exercises as a test, auto-graded (writing by the AI), then
 * hands the results to `onFinish`, whose returned node heads the summary.
 */
export function Runner({
  title,
  items,
  onFinish,
  onExit,
  onRetry,
}: {
  title: string;
  items: RunItem[];
  onFinish: (results: RunResult[]) => Promise<ReactNode>;
  onExit: () => void;
  /** Run the wrong ones again. */
  onRetry?: (wrong: RunItem[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [response, setResponse] = useState<Response>(() => blank(items[0].exercise));
  const [checked, setChecked] = useState(false);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [summary, setSummary] = useState<ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const item = items[idx];
  const ex = item?.exercise;
  const done = idx >= items.length;
  const correctNow = checked && ex ? isCorrect(ex, response) : false;

  async function check() {
    if (!ex || checked || grading || !answered(ex, response)) return;
    let r = response;
    if (r.type === 'write') {
      setGrading(true);
      try {
        r = { ...r, grade: item.grade ? await item.grade(r.text) : undefined };
      } catch (e) {
        r = { ...r, grade: { score: 0, correct: false, feedback: `Không chấm được: ${(e as Error).message}`, corrected: '', ai: false } };
      } finally {
        setGrading(false);
      }
      setResponse(r);
    }
    setChecked(true);
    setResults((list) => [...list, { item, correct: isCorrect(ex, r), response: r }]);
    if (ex.type === 'order' || ex.type === 'fix') speak(ex.type === 'order' ? ex.options.join(' ') : ex.answer[0]);
  }

  async function next() {
    const n = idx + 1;
    setIdx(n);
    setChecked(false);
    if (n < items.length) {
      setResponse(blank(items[n].exercise));
      return;
    }
    try {
      setSummary(await onFinish(results));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      if (checked) void next();
      else void check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done) {
    if (error) return <Alert>{error}</Alert>;
    if (!summary) return <p className="py-10 text-center text-sm text-fg-muted">Đang lưu kết quả…</p>;
    const wrong = results.filter((r) => !r.correct);
    return (
      <div className="space-y-6">
        {summary}
        <div className="flex flex-wrap gap-2">
          <button onClick={onExit} className="btn btn-secondary">
            <Icon name="chevron-left" /> Về Ôn tập
          </button>
          {onRetry && wrong.length > 0 && (
            <button onClick={() => onRetry(wrong.map((w) => w.item))} className="btn btn-primary">
              <Icon name="refresh" /> Làm lại {wrong.length} câu sai
            </button>
          )}
        </div>
        {wrong.length > 0 && (
          <section>
            <h2 className="section-title mb-3">Câu làm sai ({wrong.length})</h2>
            <ul className="grid gap-2 lg:grid-cols-2">
              {wrong.map(({ item: it, response: r }) => (
                <li key={it.id} className="card p-4 text-sm">
                  {it.context && <p className="mb-1 text-xs text-fg-subtle">{it.context}</p>}
                  <p className="text-fg-muted">{questionText(it.exercise)}</p>
                  <YourAnswer response={r} />
                  <p className="mt-1 font-medium text-success-text">✓ {answerText(it.exercise)}</p>
                  {it.exercise.explanation && <p className="mt-1 text-fg-secondary">{it.exercise.explanation}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <button onClick={onExit} className="btn btn-ghost btn-icon btn-sm" title="Thoát" aria-label="Thoát">
          <Icon name="x" />
        </button>
        <span className="hidden shrink-0 text-sm font-medium text-fg sm:inline">{title}</span>
        <ProgressBar value={idx / items.length} className="h-2" />
        <span className="shrink-0 text-[13px] tabular-nums text-fg-muted">
          {idx + 1}/{items.length}
        </span>
        <span className="chip tone-green shrink-0 tabular-nums">
          <Icon name="check" className="h-3 w-3" /> {results.filter((r) => r.correct).length}
        </span>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={cx('chip', SKILL_TONE[ex.type] ?? 'tone-violet')}>{TYPE_LABEL[ex.type]}</span>
          {item.missed && <span className="chip tone-red">Lần trước sai</span>}
          {item.context && <span className="text-xs text-fg-muted">{item.context}</span>}
          <span className="text-xs text-fg-subtle">· {hintOf(ex)}</span>
        </div>
        <ExerciseView key={item.id} ex={ex} response={response} onChange={setResponse} checked={checked} onSubmit={check} />
      </div>

      {checked ? (
        <div
          className={cx(
            'mt-4 rounded-xl border p-4 animate-fade-in',
            correctNow ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft',
          )}
        >
          <p className={cx('flex items-center gap-2 font-semibold', correctNow ? 'text-success-text' : 'text-danger-text')}>
            <Icon name={correctNow ? 'check' : 'x'} className="h-4 w-4" strokeWidth={2.25} />
            {correctNow ? 'Chính xác!' : 'Chưa đúng'}
          </p>
          {response.type === 'write' && response.grade && (
            <div className="mt-2 space-y-1 text-sm text-fg">
              {response.grade.ai && <p className="font-semibold tabular-nums">{response.grade.score}/100</p>}
              <p>{response.grade.feedback}</p>
              {response.grade.corrected && response.grade.corrected.trim() !== response.text.trim() && (
                <p>
                  <span className="text-fg-muted">Sửa lại: </span>
                  <span className="font-medium">{response.grade.corrected}</span>
                </p>
              )}
            </div>
          )}
          {!correctNow && ex.type !== 'write' && (
            <p className="mt-2 text-sm text-fg">
              <span className="text-fg-muted">Đáp án: </span>
              <span className="font-medium">{answerText(ex)}</span>
            </p>
          )}
          {ex.explanation && <p className="mt-1.5 text-sm text-fg-secondary">{ex.explanation}</p>}
          <button onClick={() => void next()} className="btn btn-primary mt-4 w-full sm:w-auto">
            {idx + 1 < items.length ? 'Tiếp tục' : 'Xem kết quả'}{' '}
            <span className="kbd ml-1 border-white/30 bg-white/15 text-white">Enter</span>
          </button>
        </div>
      ) : (
        <button onClick={() => void check()} disabled={grading || !answered(ex, response)} className="btn btn-primary btn-lg mt-4 w-full">
          {grading ? 'AI đang chấm…' : 'Kiểm tra'}
        </button>
      )}
    </div>
  );
}

/** The question as one line of text, for result lists. */
export function questionText(ex: Exercise): string {
  if (ex.type === 'listen' && !ex.options.length) return `🎧 ${ex.passage}`;
  if (ex.type === 'match') return ex.prompt || 'Nối từ';
  return ex.prompt || ex.options.join(' / ');
}

/** What the learner answered, from a stored or live response. */
export function YourAnswer({ response }: { response: Record<string, unknown> | Response | null }) {
  const r = (response ?? {}) as Record<string, unknown>;
  let text = '';
  if (typeof r.choice === 'string') text = r.choice;
  else if (typeof r.text === 'string') text = r.text;
  else if (Array.isArray(r.words)) text = (r.words as string[]).join(' ');
  else if (r.pairs && typeof r.pairs === 'object')
    text = Object.entries(r.pairs as Record<string, string>)
      .map(([a, b]) => `${a} = ${b}`)
      .join(' · ');
  if (!text) return null;
  return <p className="mt-1 text-danger-text">✗ Bạn trả lời: {text}</p>;
}
