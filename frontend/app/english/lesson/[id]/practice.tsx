'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, AttemptResult, Exercise, ExerciseType, LessonDetail } from '../../../lib/api';
import { answerText, isChoice, isCorrect, Response, shuffle, speak } from '../../../lib/course';
import { Icon } from '../../../components/icons';
import { Alert, cx, ProgressBar } from '../../../components/ui';

const TYPE_LABEL: Record<ExerciseType, string> = {
  mcq: 'Trắc nghiệm',
  gap: 'Điền vào chỗ trống',
  order: 'Sắp xếp thành câu',
  match: 'Nối từ với nghĩa',
  fix: 'Sửa lỗi sai',
  listen: 'Nghe',
  read: 'Đọc hiểu',
  write: 'Viết',
};

const TYPE_HINT: Record<ExerciseType, string> = {
  mcq: 'Chọn đáp án đúng (phím 1–4).',
  gap: 'Gõ từ cần điền vào chỗ trống.',
  order: 'Bấm các từ theo đúng thứ tự. Bấm lại để bỏ.',
  match: 'Bấm một từ bên trái, rồi bấm nghĩa của nó bên phải.',
  fix: 'Câu có một lỗi sai — sửa lại cả câu.',
  listen: 'Nghe rồi gõ lại đúng câu bạn nghe (không tính dấu câu).',
  read: 'Đọc đoạn văn rồi chọn đáp án đúng.',
  write: 'Viết bằng tiếng Anh theo yêu cầu — AI chấm và sửa cho bạn.',
};

const hintOf = (ex: Exercise) =>
  ex.type === 'listen' && ex.options.length ? 'Nghe đoạn nói rồi chọn đáp án đúng (phím 1–4).' : TYPE_HINT[ex.type];

/** Drill types used for a quick check (no listening/reading/writing, no matching). */
const QUICK_TYPES: ExerciseType[] = ['mcq', 'gap', 'order', 'fix'];

/** An empty answer for an exercise, ready to be filled in. */
function blank(ex: Exercise): Response {
  if (isChoice(ex)) return { type: 'mcq', choice: '' };
  switch (ex.type) {
    case 'listen':
      return { type: 'listen', text: '' };
    case 'write':
      return { type: 'write', text: '' };
    case 'mcq':
    case 'read':
      return { type: 'mcq', choice: '' };
    case 'gap':
      return { type: 'gap', text: '' };
    case 'order':
      return { type: 'order', picked: [], words: [] };
    case 'match':
      return { type: 'match', pairs: {} };
    case 'fix':
      return { type: 'fix', text: ex.prompt };
  }
}

function answered(ex: Exercise, r: Response): boolean {
  switch (r.type) {
    case 'mcq':
      return !!r.choice;
    case 'gap':
    case 'listen':
    case 'write':
      return !!r.text.trim();
    case 'fix':
      return !!r.text.trim() && r.text.trim() !== ex.prompt.trim();
    case 'order':
      return r.words.length === ex.options.length;
    case 'match':
      return Object.keys(r.pairs).length === ex.pairs.length;
  }
}

/** Exercises in a quick check: the hardest few (the list runs easy → hard), no matching. */
const QUICK_COUNT = 6;

export function Practice({
  detail,
  quick = false,
  onFinished,
  onReview,
}: {
  detail: LessonDetail;
  /** Quick check for a lesson the placement test marked as mastered. */
  quick?: boolean;
  onFinished: () => void;
  onReview?: () => void;
}) {
  const exercises = useMemo(() => {
    const all = detail.lesson.exercises ?? [];
    if (!quick) return all;
    return all.filter((e) => QUICK_TYPES.includes(e.type)).slice(-QUICK_COUNT);
  }, [detail.lesson.exercises, quick]);
  const [run, setRun] = useState(0); // bump to restart
  const [idx, setIdx] = useState(0);
  const [response, setResponse] = useState<Response>(() => blank(exercises[0]));
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; response: Response }[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [grading, setGrading] = useState(false);

  const ex = exercises[idx];
  const correctNow = checked && ex ? isCorrect(ex, response) : false;
  const done = idx >= exercises.length;

  function restart() {
    setRun((r) => r + 1);
    setIdx(0);
    setResponse(blank(exercises[0]));
    setChecked(false);
    setResults([]);
    setResult(null);
    setError(null);
  }

  async function check() {
    if (!ex || checked || grading || !answered(ex, response)) return;
    let r = response;
    if (r.type === 'write') {
      // Writing is graded by the AI on the server (the task + model answers are stored there).
      setGrading(true);
      const index = (detail.lesson.exercises ?? []).indexOf(ex);
      try {
        r = { ...r, grade: await api.course.grade(detail.lesson.id, index, r.text) };
      } catch (e) {
        r = {
          ...r,
          grade: { score: 0, correct: false, feedback: `Không chấm được: ${(e as Error).message}`, corrected: '', ai: false },
        };
      } finally {
        setGrading(false);
      }
      setResponse(r);
    }
    setChecked(true);
    const ok = isCorrect(ex, r);
    setResults((list) => [...list, { correct: ok, response: r }]);
    if (ex.type === 'order' || ex.type === 'fix') speak(ex.type === 'order' ? ex.options.join(' ') : ex.answer[0]);
  }

  async function next() {
    const n = idx + 1;
    setIdx(n);
    setChecked(false);
    if (n < exercises.length) {
      setResponse(blank(exercises[n]));
      return;
    }
    setSaving(true);
    try {
      const correct = results.filter((r) => r.correct).length;
      setResult(
        await api.course.submitAttempt(detail.lesson.id, {
          correct,
          total: exercises.length,
          answers: results.map((r) => ({ correct: r.correct, ...r.response })),
          quick,
        }),
      );
      onFinished();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Enter checks, then moves on; 1–4 pick a multiple-choice option.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (checked) next();
        else check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!exercises.length) return <Alert tone="info">Bài này chưa có bài tập.</Alert>;

  if (done) {
    if (saving || (!result && !error)) {
      return <p className="py-10 text-center text-sm text-fg-muted">Đang chấm điểm…</p>;
    }
    if (error || !result) return <Alert>{error}</Alert>;
    return (
      <Summary
        result={result}
        exercises={exercises}
        results={results}
        lessonLevel={detail.lesson.level}
        onRetry={restart}
        onReview={onReview}
      />
    );
  }

  const correctSoFar = results.filter((r) => r.correct).length;

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <ProgressBar value={idx / exercises.length} className="h-2" />
        <span className="shrink-0 text-[13px] tabular-nums text-fg-muted">
          {idx + 1}/{exercises.length}
        </span>
        <span className="chip tone-green shrink-0 tabular-nums">
          <Icon name="check" className="h-3 w-3" /> {correctSoFar}
        </span>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={cx('chip', SKILL_TONE[ex.type] ?? 'tone-violet')}>{TYPE_LABEL[ex.type]}</span>
          <span className="text-xs text-fg-subtle">{hintOf(ex)}</span>
        </div>
        <ExerciseView
          key={`${run}-${idx}`}
          ex={ex}
          response={response}
          onChange={setResponse}
          checked={checked}
          onSubmit={check}
        />
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
            <div className="mt-2 space-y-1.5 text-sm text-fg">
              {response.grade.ai && (
                <p>
                  <span className="text-fg-muted">Điểm: </span>
                  <span className="font-semibold tabular-nums">{response.grade.score}/100</span>
                </p>
              )}
              <p>{response.grade.feedback}</p>
              {response.grade.corrected && response.grade.corrected.trim() !== response.text.trim() && (
                <p>
                  <span className="text-fg-muted">Sửa lại: </span>
                  <span className="font-medium">{response.grade.corrected}</span>
                </p>
              )}
              <p>
                <span className="text-fg-muted">Câu mẫu: </span>
                {ex.answer.join('  /  ')}
              </p>
            </div>
          )}
          {!correctNow && ex.type !== 'write' && (
            <p className="mt-2 text-sm text-fg">
              <span className="text-fg-muted">Đáp án: </span>
              <span className="font-medium">{answerText(ex)}</span>
            </p>
          )}
          {ex.type === 'listen' && ex.options.length > 0 && (
            <p className="mt-2 text-sm text-fg">
              <span className="text-fg-muted">Bạn đã nghe: </span>
              {ex.passage}
            </p>
          )}
          {ex.explanation && <p className="mt-1.5 text-sm text-fg-secondary">{ex.explanation}</p>}
          <button onClick={next} className="btn btn-primary mt-4 w-full sm:w-auto">
            {idx + 1 < exercises.length ? 'Tiếp tục' : 'Xem kết quả'} <span className="kbd ml-1 border-white/30 bg-white/15 text-white">Enter</span>
          </button>
        </div>
      ) : (
        <button onClick={check} disabled={grading || !answered(ex, response)} className="btn btn-primary btn-lg mt-4 w-full">
          {grading ? 'AI đang chấm…' : 'Kiểm tra'}{' '}
          {!grading && <span className="kbd ml-1 border-white/30 bg-white/15 text-white">Enter</span>}
        </button>
      )}
    </div>
  );
}

function ExerciseView({
  ex,
  response,
  onChange,
  checked,
  onSubmit,
}: {
  ex: Exercise;
  response: Response;
  onChange: (r: Response) => void;
  checked: boolean;
  onSubmit: () => void;
}) {
  // Shuffle once per exercise (the model lists the right option/order first).
  const options = useMemo(() => shuffle(ex.options), [ex]);
  const rights = useMemo(() => shuffle(ex.pairs.map((p) => p.right)), [ex]);

  // Listening plays once on arrival; the buttons replay it.
  useEffect(() => {
    if (ex.type === 'listen' && ex.passage) speak(ex.passage);
  }, [ex]);

  useEffect(() => {
    if (!isChoice(ex) || checked) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onChange({ type: 'mcq', choice: options[n - 1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ex, checked, options, onChange]);

  const lead =
    ex.type === 'read' ? (
      <Passage text={ex.passage ?? ''} />
    ) : ex.type === 'listen' ? (
      <AudioBar text={ex.passage ?? ''} />
    ) : null;

  if (response.type === 'listen') {
    return (
      <>
        {lead}
        <input
          autoFocus
          disabled={checked}
          value={response.text}
          onChange={(e) => onChange({ type: 'listen', text: e.target.value })}
          placeholder="Gõ câu bạn nghe được…"
          className={cx('input w-full text-base', checked && (isCorrect(ex, response) ? 'border-success' : 'border-danger'))}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {checked && (
          <p className="mt-3 text-[15px] text-fg">
            <span className="text-fg-muted">Câu gốc: </span>
            {ex.passage}
          </p>
        )}
      </>
    );
  }

  if (response.type === 'write') {
    return (
      <>
        <p className="mb-3 text-lg font-medium leading-relaxed text-fg">{ex.prompt}</p>
        <textarea
          autoFocus
          disabled={checked}
          value={response.text}
          onChange={(e) => onChange({ type: 'write', text: e.target.value })}
          rows={3}
          placeholder="Write your answer in English…"
          className="input w-full resize-y text-base"
          spellCheck={false}
        />
        <p className="hint mt-1">Enter để nộp · Shift+Enter xuống dòng.</p>
      </>
    );
  }

  if (response.type === 'mcq') {
    return (
      <>
        {lead}
        <p className="mb-4 text-lg font-medium leading-relaxed text-fg">{ex.prompt}</p>
        <div className="grid gap-2 lg:grid-cols-2">
          {options.map((o, i) => {
            const chosen = response.choice === o;
            const right = checked && o === ex.answer[0];
            const wrong = checked && chosen && !right;
            return (
              <button
                key={o}
                disabled={checked}
                onClick={() => onChange({ type: 'mcq', choice: o })}
                className={cx(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[15px] transition',
                  right
                    ? 'border-success bg-success-soft text-success-text'
                    : wrong
                      ? 'border-danger bg-danger-soft text-danger-text'
                      : chosen
                        ? 'border-accent bg-accent-soft text-fg'
                        : 'border-line-strong hover:bg-subtle',
                )}
              >
                <span className="kbd">{i + 1}</span>
                {o}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  if (response.type === 'gap') {
    const [before, after] = ex.prompt.split('___');
    return (
      <p className="text-lg leading-loose text-fg">
        {before}
        <input
          autoFocus
          disabled={checked}
          value={response.text}
          onChange={(e) => onChange({ type: 'gap', text: e.target.value })}
          className={cx(
            'input mx-1 inline-block w-48 py-1 text-base',
            checked && (isCorrect(ex, response) ? 'border-success' : 'border-danger'),
          )}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {after}
      </p>
    );
  }

  if (response.type === 'fix') {
    return (
      <>
        <p className="mb-3 text-lg font-medium text-fg">
          <span className="text-danger-text">✗</span> {ex.prompt}
        </p>
        <input
          autoFocus
          disabled={checked}
          value={response.text}
          onChange={(e) => onChange({ type: 'fix', text: e.target.value })}
          className="input text-base"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="hint mt-1">Sửa trực tiếp trong ô, rồi bấm Kiểm tra.</p>
      </>
    );
  }

  if (response.type === 'order') {
    // Track picks by position: the same word can appear twice in a sentence.
    const picked = response.picked;
    const setPicked = (next: number[]) =>
      onChange({ type: 'order', picked: next, words: next.map((i) => options[i]) });
    return (
      <>
        {ex.prompt && <p className="mb-3 text-sm text-fg-muted">{ex.prompt}</p>}
        <div
          className={cx(
            'mb-4 flex min-h-[3.25rem] flex-wrap gap-2 rounded-lg border border-dashed p-2',
            checked ? (isCorrect(ex, response) ? 'border-success' : 'border-danger') : 'border-line-strong',
          )}
        >
          {picked.map((i, pos) => (
            <button
              key={pos}
              disabled={checked}
              onClick={() => setPicked(picked.filter((_, p) => p !== pos))}
              className="rounded-md border border-accent bg-accent-soft px-2.5 py-1 text-[15px] text-fg"
            >
              {options[i]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((w, i) =>
            picked.includes(i) ? (
              <span key={i} className="rounded-md border border-line px-2.5 py-1 text-[15px] text-transparent">
                {w}
              </span>
            ) : (
              <button
                key={i}
                disabled={checked}
                onClick={() => setPicked([...picked, i])}
                className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-[15px] text-fg hover:bg-subtle"
              >
                {w}
              </button>
            ),
          )}
        </div>
      </>
    );
  }

  return <MatchView ex={ex} rights={rights} response={response} onChange={onChange} checked={checked} />;
}

const SKILL_TONE: Partial<Record<ExerciseType, string>> = {
  listen: 'tone-sky',
  read: 'tone-amber',
  write: 'tone-green',
};

/** Play / slow-play buttons for a listening item (the text stays hidden). */
function AudioBar({ text }: { text: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => speak(text)} className="btn btn-secondary">
        <Icon name="volume" /> Nghe
      </button>
      <button type="button" onClick={() => speak(text, 0.7)} className="btn btn-ghost">
        <Icon name="volume" /> Nghe chậm
      </button>
    </div>
  );
}

/** A reading text, with a button to hear it read aloud. */
function Passage({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-lg border border-line bg-subtle p-4">
      <p className="max-h-72 overflow-y-auto whitespace-pre-line text-[15px] leading-relaxed text-fg">{text}</p>
      <button type="button" onClick={() => speak(text)} className="btn btn-ghost btn-xs mt-2 text-fg-muted">
        <Icon name="volume" /> Nghe đoạn văn
      </button>
    </div>
  );
}

function MatchView({
  ex,
  rights,
  response,
  onChange,
  checked,
}: {
  ex: Exercise;
  rights: string[];
  response: Extract<Response, { type: 'match' }>;
  onChange: (r: Response) => void;
  checked: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const takenRights = new Set(Object.values(response.pairs));

  function pickLeft(left: string) {
    if (checked) return;
    if (response.pairs[left]) {
      const pairs = { ...response.pairs };
      delete pairs[left];
      onChange({ type: 'match', pairs });
    }
    setActive(left);
  }

  function pickRight(right: string) {
    if (checked || !active) return;
    const pairs = { ...response.pairs };
    for (const k of Object.keys(pairs)) if (pairs[k] === right) delete pairs[k];
    pairs[active] = right;
    onChange({ type: 'match', pairs });
    setActive(ex.pairs.find((p) => !pairs[p.left])?.left ?? null);
  }

  return (
    <>
      {ex.prompt && <p className="mb-3 text-sm text-fg-muted">{ex.prompt}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {ex.pairs.map(({ left, right }) => {
            const chosen = response.pairs[left];
            const ok = checked && chosen === right;
            return (
              <button
                key={left}
                onClick={() => pickLeft(left)}
                className={cx(
                  'block w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                  checked
                    ? ok
                      ? 'border-success bg-success-soft'
                      : 'border-danger bg-danger-soft'
                    : active === left
                      ? 'border-accent ring-1 ring-accent'
                      : chosen
                        ? 'border-accent bg-accent-soft'
                        : 'border-line-strong hover:bg-subtle',
                )}
              >
                <span className="font-medium text-fg">{left}</span>
                {chosen && <span className="block text-xs text-fg-muted">→ {chosen}</span>}
                {checked && !ok && <span className="block text-xs text-success-text">✓ {right}</span>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r) => (
            <button
              key={r}
              disabled={checked || !active}
              onClick={() => pickRight(r)}
              className={cx(
                'block w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                takenRights.has(r) ? 'border-line text-fg-subtle' : 'border-line-strong text-fg hover:bg-subtle',
                !active && !checked && 'opacity-70',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Summary({
  result,
  exercises,
  results,
  lessonLevel,
  onRetry,
  onReview,
}: {
  result: AttemptResult;
  exercises: Exercise[];
  results: { correct: boolean }[];
  lessonLevel: string;
  onRetry: () => void;
  onReview?: () => void;
}) {
  const wrong = exercises.filter((_, i) => !results[i]?.correct);
  return (
    <div className="space-y-6">
      <div className="card p-8 text-center">
        <span
          className={cx(
            'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
            result.passed ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text',
          )}
        >
          <Icon name={result.passed ? 'check' : 'refresh'} className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <p className="text-[40px] font-semibold leading-none tabular-nums text-fg">{result.score}%</p>
        <p className="mt-2 text-fg-muted">
          {result.passed
            ? result.firstPass
              ? 'Qua bài!'
              : 'Qua bài!'
            : `Cần ≥ ${result.passScore}% để qua bài — thử lại nhé.`}
        </p>
        {result.firstPass && (
          <div className="mx-auto mt-5 max-w-sm text-left">
            <div className="mb-1 flex justify-between text-xs text-fg-muted">
              <span>
                Hành trình {result.journey.start === result.journey.target ? result.journey.target : `${result.journey.start} → ${result.journey.target}`}
              </span>
              <span className="tabular-nums">
                {result.journey.pct}% · còn {result.journey.total - result.journey.done} bài
              </span>
            </div>
            <ProgressBar value={result.journey.total ? result.journey.done / result.journey.total : 0} />
            <p className="mt-1.5 text-center text-xs text-fg-muted">
              7 ngày qua: {result.journey.last7}/{result.journey.weeklyLessons} bài
              {result.journey.streak > 0 && ` · chuỗi ${result.journey.streak} ngày`}
            </p>
          </div>
        )}
        {result.cardsAdded > 0 && (
          <p className="mt-1 text-[13px] text-fg-muted">
            {result.cardsAdded} từ vựng đã vào{' '}
            <Link href="/english/review" className="link">
              hàng đợi ôn thẻ
            </Link>
            .
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!result.passed && onReview && (
            <button onClick={onReview} className="btn btn-secondary">
              Ôn lại lý thuyết
            </button>
          )}
          <button onClick={onRetry} className={cx('btn', result.passed ? 'btn-secondary' : 'btn-primary')}>
            <Icon name="refresh" /> Làm lại
          </button>
          {result.passed && result.nextId && (
            <Link href={`/english/lesson/${result.nextId}`} className="btn btn-primary">
              Bài tiếp theo <Icon name="arrow-right" />
            </Link>
          )}
          {result.passed && !result.nextId && (
            <Link href={`/english?level=${lessonLevel}`} className="btn btn-primary">
              Về khóa học
            </Link>
          )}
        </div>
      </div>

      {wrong.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Câu làm sai ({wrong.length})</h2>
          <ul className="space-y-2">
            {wrong.map((ex, i) => (
              <li key={i} className="card p-4 text-sm">
                <p className="text-fg-muted">
                  {ex.type === 'match'
                    ? ex.prompt || 'Nối từ'
                    : ex.type === 'listen' && !ex.options.length
                      ? `🎧 ${ex.passage}`
                      : ex.prompt || ex.options.join(' / ')}
                </p>
                <p className="mt-1 font-medium text-fg">✓ {answerText(ex)}</p>
                {ex.explanation && <p className="mt-1 text-fg-secondary">{ex.explanation}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
