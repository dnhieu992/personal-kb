'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  api,
  CourseLevel,
  PlacementItem,
  PlacementResult,
  PlacementReviewItem,
  PlacementSkill,
  PlacementTest,
} from '@/features/english/api';
import { shuffle, speak } from '@/features/english/course';
import { stopSpeech } from '@/features/english/speech';
import { Icon } from '@/shared/ui/icons';
import { Alert, cx, Loading, PageHeader, ProgressBar } from '@/shared/ui/kit';

const SKILL_LABEL: Record<PlacementSkill, string> = {
  grammar: 'Ngữ pháp',
  vocab: 'Từ vựng',
  reading: 'Đọc hiểu',
  listening: 'Nghe',
};

const SKILL_TONE: Record<PlacementSkill, string> = {
  grammar: 'tone-violet',
  vocab: 'tone-teal',
  reading: 'tone-sky',
  listening: 'tone-amber',
};

const LEVEL_NAME: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
};

/** Listening clips can be played this many times, like in a real test. */
const MAX_PLAYS = 2;
/** Sent for "I don't know" — always graded wrong, discourages guessing. */
const SKIP = '';

type Phase = 'intro' | 'test' | 'between' | 'result';

export default function PlacementPage() {
  const [test, setTest] = useState<PlacementTest | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [levelIdx, setLevelIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.course.placementTest(), api.course.placement()])
      .then(([t, r]) => {
        setTest(t);
        setResult(r);
        if (r?.inAppTaken) setPhase('result');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  const blocks = useMemo(() => {
    if (!test) return [];
    return test.levels.map((level) => test.items.filter((i) => i.level === level));
  }, [test]);
  const totalItems = test?.items.length ?? 0;
  const answeredCount = Object.keys(answers).length;

  function start() {
    setAnswers({});
    setLevelIdx(0);
    setItemIdx(0);
    setError(null);
    setPhase('test');
  }

  const finish = useCallback(async (all: Record<string, string>) => {
    setBusy(true);
    try {
      setResult(await api.course.submitPlacement(all));
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  async function answer(item: PlacementItem, choice: string) {
    const all = { ...answers, [item.id]: choice };
    setAnswers(all);
    const block = blocks[levelIdx];
    if (itemIdx + 1 < block.length) {
      setItemIdx(itemIdx + 1);
      return;
    }
    // End of a level block: go on only if it was not too hard.
    setBusy(true);
    try {
      const r = await api.course.checkBlock(block[0].level, all);
      const more = r.next && levelIdx + 1 < blocks.length;
      if (more) {
        setLevelIdx(levelIdx + 1);
        setItemIdx(0);
        setPhase('between');
      } else {
        await finish(all);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Loading label="Đang tải bài test…" />;
  if (!test) return <Alert title="Không tải được bài test.">{error}</Alert>;

  const header = (
    <PageHeader
      back={{ href: '/english', label: 'English for IT' }}
      title="Test xếp lớp"
      description="Xác định trình độ CEFR của bạn để xếp level và lộ trình bài học phù hợp."
    />
  );

  if (phase === 'test' || phase === 'between') {
    const block = blocks[levelIdx];
    const level = block[0].level;
    return (
      <div className="w-full">
        {header}
        {error && <Alert className="mb-4">{error}</Alert>}
        <div className="mb-5">
          <div className="mb-1.5 flex justify-between text-xs text-fg-muted">
            <span>
              Phần {levelIdx + 1}/{blocks.length} · Level {level}
            </span>
            <span className="tabular-nums">
              {answeredCount}/{totalItems} câu
            </span>
          </div>
          <ProgressBar value={totalItems ? answeredCount / totalItems : 0} />
        </div>
        {phase === 'between' ? (
          <div className="card p-6 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success-text">
              <Icon name="check" className="h-5 w-5" />
            </span>
            <p className="text-base font-semibold text-fg">Xong phần {blocks[levelIdx - 1][0].level}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
              Phần tiếp theo là level {level}, khó hơn một bậc. Cứ làm hết sức — gặp câu không biết thì bấm
              “Tôi không biết”, đừng đoán.
            </p>
            <button onClick={() => setPhase('test')} className="btn btn-primary mt-5" autoFocus>
              Tiếp tục phần {level} <Icon name="chevron-right" />
            </button>
          </div>
        ) : (
          <Question
            key={block[itemIdx].id}
            item={block[itemIdx]}
            number={itemIdx + 1}
            of={block.length}
            busy={busy}
            onAnswer={(c) => answer(block[itemIdx], c)}
          />
        )}
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="w-full">
        {header}
        <ResultView result={result} onRetake={start} onResult={setResult} />
      </div>
    );
  }

  // Intro
  return (
    <div className="w-full space-y-6">
      {header}
      {error && <Alert>{error}</Alert>}
      <section className="card p-6">
        <p className="eyebrow">Cách làm</p>
        <h2 className="mt-1 text-lg font-semibold text-fg">{totalItems} câu · khoảng 15–25 phút</h2>
        <ul className="mt-3 space-y-2 text-sm text-fg-muted">
          <li className="flex gap-2">
            <Icon name="target" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
            4 phần từ dễ đến khó: {test.levels.join(' → ')}. Mỗi phần 12 câu gồm ngữ pháp, từ vựng, một đoạn đọc
            và một đoạn nghe, tất cả trong bối cảnh công việc IT.
          </li>
          <li className="flex gap-2">
            <Icon name="volume" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
            Câu nghe được phát {MAX_PLAYS} lần, không có lời thoại — hãy bật loa/tai nghe.
          </li>
          <li className="flex gap-2">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
            Không biết thì bấm “Tôi không biết”, đừng đoán — đoán trúng sẽ xếp bạn vào level quá khó. Phần nào sai quá
            nửa thì bài dừng sớm.
          </li>
          <li className="flex gap-2">
            <Icon name="graduation" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
            Kết quả: level bạn nên học (phần đầu tiên chưa đạt {Math.round(test.passShare * 100)}%), các điểm ngữ pháp đã
            vững (được bỏ qua bằng kiểm tra nhanh) và điểm yếu (được ưu tiên học trước).
          </li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={start} className="btn btn-primary">
            <Icon name="play" /> Bắt đầu làm bài
          </button>
          {result && (
            <button onClick={() => setPhase('result')} className="btn btn-secondary">
              Xem kết quả trước
            </button>
          )}
        </div>
      </section>
      <EfsetCard result={result} onSaved={setResult} />
      <Sources />
    </div>
  );
}

function Question({
  item,
  number,
  of,
  busy,
  onAnswer,
}: {
  item: PlacementItem;
  number: number;
  of: number;
  busy: boolean;
  onAnswer: (choice: string) => void;
}) {
  const options = useMemo(() => shuffle(item.options), [item]);
  const [choice, setChoice] = useState<string | null>(null);
  const [plays, setPlays] = useState(0);

  function play() {
    if (!item.audio || plays >= MAX_PLAYS) return;
    speak(item.audio, 0.92);
    setPlays((p) => p + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) setChoice(options[n - 1]);
      if (e.key === 'Enter' && choice !== null) onAnswer(choice);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => stopSpeech(), []);

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className={cx('chip', SKILL_TONE[item.skill])}>{SKILL_LABEL[item.skill]}</span>
        <span className="text-xs tabular-nums text-fg-subtle">
          Câu {number}/{of}
        </span>
      </div>

      {item.passage && (
        <div className="mb-4 whitespace-pre-line rounded-lg border border-line bg-subtle p-4 text-sm leading-6 text-fg">
          {item.passage}
        </div>
      )}

      {item.audio && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-subtle p-4">
          <button onClick={play} disabled={plays >= MAX_PLAYS} className="btn btn-secondary">
            <Icon name="volume" /> {plays ? 'Nghe lại' : 'Nghe'}
          </button>
          <span className="text-xs text-fg-muted">
            Còn {MAX_PLAYS - plays}/{MAX_PLAYS} lượt nghe
          </span>
        </div>
      )}

      <p className="text-[15px] font-medium leading-7 text-fg">{item.prompt}</p>

      <div className="mt-4 grid gap-2">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => setChoice(o)}
            className={cx(
              'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition',
              choice === o ? 'border-accent bg-accent-soft text-fg ring-1 ring-accent' : 'border-line hover:bg-subtle',
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs tabular-nums text-fg-muted">
              {i + 1}
            </span>
            {o}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => onAnswer(SKIP)} disabled={busy} className="btn btn-ghost btn-sm text-fg-muted">
          Tôi không biết
        </button>
        <button onClick={() => choice !== null && onAnswer(choice)} disabled={choice === null || busy} className="btn btn-primary">
          {busy ? 'Đang chấm…' : 'Tiếp'} <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onRetake,
  onResult,
}: {
  result: PlacementResult;
  onRetake: () => void;
  onResult: (r: PlacementResult) => void;
}) {
  const [review, setReview] = useState<PlacementReviewItem[] | null>(null);
  const [showReview, setShowReview] = useState(false);
  const placed = result.placedLevel;

  useEffect(() => {
    if (showReview && !review && result.inAppTaken) api.course.placementReview(result.id).then(setReview).catch(() => {});
  }, [showReview, review, result]);

  const agree = result.efsetLevel && result.inAppTaken ? clampLevel(result.efsetLevel) === placed : null;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Level đề xuất</p>
            <p className="mt-1 text-[40px] font-semibold leading-none text-fg">
              {placed}
              <span className="ml-3 text-base font-normal text-fg-muted">{LEVEL_NAME[placed]}</span>
            </p>
            <p className="mt-2 max-w-lg text-sm text-fg-muted">
              {result.inAppTaken
                ? `Đây là level đầu tiên bạn chưa đạt ${75}% trong bài test — học từ đây sẽ vừa sức nhất. Bạn trả lời đúng ${result.score}% số câu đã làm.`
                : 'Xếp theo điểm EF SET bạn nhập. Làm thêm test trong app để biết điểm ngữ pháp nào đã vững, điểm nào yếu.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href={`/english?level=${placed}`} className="btn btn-primary">
              <Icon name="play" /> Học level {placed}
            </Link>
            <button onClick={onRetake} className="btn btn-secondary btn-sm">
              <Icon name="refresh" /> {result.inAppTaken ? 'Làm lại test' : 'Làm test trong app'}
            </button>
          </div>
        </div>

        {result.inAppTaken && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Theo level</p>
              <div className="space-y-2.5">
                {result.levels.map((l) => (
                  <div key={l.level}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={cx('font-medium', l.level === placed ? 'text-accent-text' : 'text-fg')}>
                        {l.level} {l.level === placed && '· level của bạn'}
                      </span>
                      <span className="tabular-nums text-fg-muted">
                        {l.taken ? `${l.correct}/${l.total}` : 'không làm (dừng sớm)'}
                      </span>
                    </div>
                    <ProgressBar value={l.taken ? l.correct / l.total : 0} tone={l.taken && l.correct / l.total >= 0.75 ? 'success' : 'accent'} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Theo kỹ năng</p>
              <div className="space-y-2.5">
                {result.skills.map((s) => (
                  <div key={s.skill}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-fg">{SKILL_LABEL[s.skill]}</span>
                      <span className="tabular-nums text-fg-muted">
                        {s.correct}/{s.total}
                      </span>
                    </div>
                    <ProgressBar value={s.total ? s.correct / s.total : 0} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {result.inAppTaken && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PointList
            title="Cần củng cố"
            hint="Bài dạy những điểm này được mở ngay và đề xuất học trước."
            tone="tone-amber"
            points={result.weakPoints}
          />
          <PointList
            title="Đã vững"
            hint="Bài dạy những điểm này không chặn lộ trình; làm kiểm tra nhanh (≥ 80%) là qua."
            tone="tone-green"
            points={result.masteredPoints}
          />
        </div>
      )}

      {agree === false && (
        <Alert tone="info" title="Kết quả EF SET khác với test trong app">
          EF SET {result.efsetScore}/100 tương ứng {result.efsetLevel}, còn test trong app xếp bạn vào {placed}. EF SET chỉ đo
          đọc + nghe và dài hơn nên ổn định hơn về tổng thể; test trong app thì chỉ ra điểm ngữ pháp cụ thể. Bạn có thể
          chọn level khác ở trang khóa học.
        </Alert>
      )}

      <EfsetCard result={result} onSaved={onResult} />

      {result.inAppTaken && (
        <section className="card">
          <button
            onClick={() => setShowReview((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-fg"
          >
            Xem lại đáp án
            <Icon name="chevron-right" className={cx('h-4 w-4 text-fg-faint transition', showReview && 'rotate-90')} />
          </button>
          {showReview && (
            <div className="divide-y divide-line border-t border-line">
              {!review && <div className="px-5"><Loading /></div>}
              {review?.map((i) => (
                <div key={i.id} className="flex gap-3 px-5 py-3 text-sm">
                  <span
                    className={cx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      i.correct ? 'bg-success-soft text-success-text' : 'bg-danger-soft text-danger-text',
                    )}
                  >
                    <Icon name={i.correct ? 'check' : 'x'} className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-fg-subtle">
                      {i.level} · {SKILL_LABEL[i.skill]}
                    </p>
                    {i.audio && <p className="mt-0.5 italic text-fg-muted">“{i.audio}”</p>}
                    <p className="text-fg">{i.prompt}</p>
                    <p className="mt-0.5 text-fg-muted">
                      Đáp án: <span className="font-medium text-success-text">{i.answer}</span>
                      {!i.correct && (
                        <>
                          {' '}· Bạn chọn: <span className="text-danger-text">{i.chosen || 'không biết'}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Sources />
    </div>
  );
}

function clampLevel(l: string): CourseLevel {
  if (l === 'A1') return 'A2';
  if (l === 'C2') return 'C1';
  return l as CourseLevel;
}

function PointList({
  title,
  hint,
  tone,
  points,
}: {
  title: string;
  hint: string;
  tone: string;
  points: PlacementResult['weakPoints'];
}) {
  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold text-fg">
        {title} <span className="font-normal text-fg-muted">· {points.length}</span>
      </h3>
      <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>
      {points.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {points.map((p) => (
            <li key={p.key} className={cx('chip', tone)} title={p.name}>
              {p.level} · {p.vi}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-fg-subtle">Không có.</p>
      )}
    </section>
  );
}

function EfsetCard({ result, onSaved }: { result: PlacementResult | null; onSaved: (r: PlacementResult) => void }) {
  const [score, setScore] = useState(result?.efsetScore?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = Number(score);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      setError('Điểm EF SET là số nguyên từ 0 đến 100.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.course.setEfset(n));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-lg">
          <p className="eyebrow">Đối chiếu với bài thi chuẩn</p>
          <h3 className="mt-1 text-sm font-semibold text-fg">EF SET — miễn phí, 50 phút, có chứng chỉ</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            Bài thi chuẩn hóa của EF (đọc + nghe, thích ứng theo năng lực), điểm 0–100 quy ra CEFR: 31–40 A2 · 41–50 B1 ·
            51–60 B2 · 61–70 C1 · 71+ C2. Làm xong nhập điểm vào đây để so với kết quả trong app.
          </p>
          <a
            href="https://www.efset.org/ef-set-50/"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline"
          >
            Làm EF SET trên efset.org <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-fg-muted" htmlFor="efset">
            Điểm EF SET của bạn
          </label>
          <div className="flex gap-2">
            <input
              id="efset"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="input w-24 tabular-nums"
              placeholder="0–100"
            />
            <button onClick={save} disabled={saving || score === ''} className="btn btn-secondary">
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
          {result?.efsetLevel && (
            <p className="mt-1.5 text-xs text-fg-muted">
              Đã lưu: {result.efsetScore}/100 → <span className="font-medium text-fg">{result.efsetLevel}</span>
            </p>
          )}
          {error && <p className="mt-1.5 text-xs text-danger-text">{error}</p>}
        </div>
      </div>
    </section>
  );
}

function Sources() {
  return (
    <p className="text-xs leading-5 text-fg-subtle">
      Câu hỏi do app tự soạn (không sao chép đề thi), mỗi câu gắn với một điểm trong{' '}
      <a className="underline" href="https://www.eaquals.org/resources/the-core-inventory-for-general-english/" target="_blank" rel="noreferrer">
        British Council – EAQUALS Core Inventory
      </a>{' '}
      và thang{' '}
      <a className="underline" href="https://www.coe.int/en/web/common-european-framework-reference-languages" target="_blank" rel="noreferrer">
        CEFR
      </a>
      . Đây là bài test ngắn để xếp lớp, không thay cho chứng chỉ.
    </p>
  );
}
