'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { speak } from '../../../lib/course';
import { stopSpeech } from '../../../lib/speech';
import { Icon } from '../../../components/icons';
import { cx } from '../../../components/ui';
import { comboMultiplier, starsFor } from '../progress';
import { basePoints, buildPuzzles, check, Check, Chip, LevelDef, Puzzle, roundTime } from './engine';

export interface WrongTry {
  key: string;
  text: string;
  why?: string;
}

export interface SentenceOutcome {
  def: LevelDef;
  won: boolean;
  timeUp: boolean;
  score: number;
  timeBonus: number;
  stars: number;
  maxCombo: number;
  puzzles: Puzzle[];
  solved: string[];
  clean: string[];
  missed: string[];
  revealed: string[];
  wrong: WrongTry[];
}

type Status = 'build' | 'solved' | 'revealed';

/**
 * One round of "Nối từ": read the Vietnamese meaning, tap the words in order to
 * build the English sentence, check. Wrong tries cost a heart and show which
 * words are in the right place; after two tries you may reveal the answer.
 */
export function SentenceGame({
  def,
  sound,
  onToggleSound,
  onDone,
  onExit,
}: {
  def: LevelDef;
  sound: boolean;
  onToggleSound: () => void;
  onDone: (o: SentenceOutcome) => void;
  onExit: () => void;
}) {
  const [puzzles] = useState(() => buildPuzzles(def));
  const [total] = useState(() => roundTime(def, puzzles));
  const [idx, setIdx] = useState(0);
  const [placed, setPlaced] = useState<Chip[]>([]);
  const [status, setStatus] = useState<Status>('build');
  const [result, setResult] = useState<Check | null>(null);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [hearts, setHearts] = useState(def.hearts);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [gain, setGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(total ?? 0);
  const [shake, setShake] = useState(false);

  const log = useRef({ solved: [] as string[], clean: [] as string[], missed: new Set<string>(), revealed: [] as string[], wrong: [] as WrongTry[] });
  const finished = useRef(false);
  const puzzle = puzzles[idx];

  const finish = useCallback(
    (won: boolean, s: { score: number; timeLeft: number; maxCombo: number }) => {
      if (finished.current) return;
      finished.current = true;
      const l = log.current;
      const timeBonus = won && total ? s.timeLeft * 3 : 0;
      onDone({
        def,
        won,
        timeUp: !won && !!total && s.timeLeft <= 0,
        score: s.score + timeBonus,
        timeBonus,
        stars: won ? starsFor(l.wrong.length + l.revealed.length) : 0,
        maxCombo: s.maxCombo,
        puzzles,
        solved: l.solved,
        clean: l.clean,
        missed: [...l.missed],
        revealed: l.revealed,
        wrong: l.wrong,
      });
    },
    [def, puzzles, total, onDone],
  );

  // Clock runs only while you're building a sentence.
  const live = useRef({ score, maxCombo });
  live.current = { score, maxCombo };
  useEffect(() => {
    if (!total || status !== 'build') return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (finished.current) return s;
        if (s <= 1) {
          setTimeout(() => finish(false, { ...live.current, timeLeft: 0 }), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [total, status, finish]);

  useEffect(() => () => stopSpeech(), []);

  const place = useCallback(
    (chip: Chip) => {
      if (status !== 'build' || finished.current || placed.some((c) => c.id === chip.id)) return;
      setPlaced((p) => [...p, chip]);
      setResult(null);
    },
    [status, placed],
  );
  const unplace = useCallback(
    (id: string) => {
      if (status !== 'build') return;
      setPlaced((p) => p.filter((c) => c.id !== id));
      setResult(null);
    },
    [status],
  );

  const submit = useCallback(() => {
    if (status !== 'build' || finished.current || placed.length < puzzle.words) return;
    const r = check(puzzle.item, placed);
    setResult(r);
    if (r.ok) {
      const nextCombo = combo + 1;
      const g = Math.round(basePoints(puzzle.words) * comboMultiplier(nextCombo) * (hint && !def.freeHint ? 0.5 : 1));
      setCombo(nextCombo);
      setMaxCombo((m) => Math.max(m, nextCombo));
      setScore((s) => s + g);
      setGain(g);
      setStatus('solved');
      log.current.solved.push(puzzle.key);
      if (tries === 0) log.current.clean.push(puzzle.key);
      if (sound) speak(puzzle.item.s, 0.9);
      return;
    }
    const text = placed.map((c) => c.text).join(' ');
    log.current.wrong.push({ key: puzzle.key, text, why: r.usedTrap ? puzzle.item.why : undefined });
    log.current.missed.add(puzzle.key);
    setTries((t) => t + 1);
    setCombo(0);
    setShake(true);
    setTimeout(() => setShake(false), 420);
    const h = hearts - 1;
    setHearts(h);
    if (h <= 0) setTimeout(() => finish(false, { score, timeLeft, maxCombo }), 900);
  }, [status, placed, puzzle, combo, hint, def.freeHint, tries, sound, hearts, score, timeLeft, maxCombo, finish]);

  const reveal = useCallback(() => {
    if (status !== 'build') return;
    const order = puzzle.chips.filter((c) => !c.trap).sort((a, b) => Number(a.id.split('-').pop()) - Number(b.id.split('-').pop()));
    setPlaced(order);
    setResult(null);
    setStatus('revealed');
    setCombo(0);
    log.current.revealed.push(puzzle.key);
    log.current.missed.add(puzzle.key);
    if (sound) speak(puzzle.item.s, 0.9);
  }, [status, puzzle, sound]);

  const next = useCallback(() => {
    if (status === 'build' || finished.current) return;
    if (idx + 1 >= puzzles.length) return finish(true, { score, timeLeft, maxCombo });
    setIdx(idx + 1);
    setPlaced([]);
    setResult(null);
    setTries(0);
    setHint(false);
    setStatus('build');
  }, [status, idx, puzzles.length, finish, score, timeLeft, maxCombo]);

  // Keyboard: 1–9 pick a word, Backspace undo, Esc clear, Enter check / next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        return status === 'build' ? submit() : next();
      }
      if (status !== 'build') return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPlaced((p) => p.slice(0, -1));
        setResult(null);
      } else if (e.key === 'Escape') {
        setPlaced([]);
        setResult(null);
      } else {
        const n = Number(e.key);
        if (n >= 1 && n <= 9 && puzzle.chips[n - 1]) place(puzzle.chips[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, submit, next, place, puzzle]);

  if (!puzzle) return null;
  const pct = total ? timeLeft / total : 1;
  const placedIds = new Set(placed.map((c) => c.id));
  const showHint = def.freeHint || hint || status !== 'build';
  const correctCount = result ? result.marks.filter(Boolean).length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* HUD */}
      <div className="card sticky top-2 z-10 space-y-2 px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button className="btn btn-ghost btn-sm -ml-2" onClick={onExit}>
            <Icon name="chevron-left" /> Thoát
          </button>
          <div className="min-w-[120px] flex-1">
            <div className="truncate text-sm font-semibold text-fg">
              {def.boss && '👑 '}
              {def.name}
            </div>
            <div className="text-2xs text-fg-muted">
              Câu {idx + 1}/{puzzles.length}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-0.5" title={`${hearts} mạng`}>
              {Array.from({ length: def.hearts }, (_, i) => (
                <Icon key={i} name="heart" className={cx('h-4 w-4 transition-colors', i < hearts ? 'fill-current text-danger' : 'text-fg-faint')} />
              ))}
            </div>
            <span className={cx('chip tabular-nums', combo >= 2 ? 'tone-orange' : 'tone-gray')} title="Combo">
              <Icon name="flame" className="h-3.5 w-3.5" /> x{comboMultiplier(Math.max(1, combo))}
            </span>
            <span className="text-sm font-semibold tabular-nums text-fg">{score} đ</span>
            {total && (
              <span className={cx('flex items-center gap-1 text-sm tabular-nums', pct < 0.25 ? 'font-semibold text-danger-text' : 'text-fg-muted')}>
                <Icon name="clock" className="h-3.5 w-3.5" /> {timeLeft}s
              </span>
            )}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggleSound} title={sound ? 'Tắt đọc to' : 'Bật đọc to'}>
              <Icon name="volume" className={cx(!sound && 'opacity-40')} />
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          {puzzles.map((p, i) => (
            <div
              key={p.key}
              className={cx(
                'h-1 flex-1 rounded-full',
                i < idx || (i === idx && status !== 'build')
                  ? log.current.revealed.includes(p.key)
                    ? 'bg-danger'
                    : log.current.missed.has(p.key)
                      ? 'bg-warning'
                      : 'bg-success'
                  : i === idx
                    ? 'bg-accent'
                    : 'bg-emphasis',
              )}
            />
          ))}
        </div>
        {total && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-emphasis">
            <div
              className={cx('h-full rounded-full transition-all duration-1000 ease-linear', pct < 0.25 ? 'bg-danger' : pct < 0.5 ? 'bg-warning' : 'bg-accent')}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Prompt */}
      <div key={puzzle.key} className="card animate-pop-in space-y-2 px-5 py-4">
        <div className="eyebrow">Xếp các từ thành câu có nghĩa</div>
        <p className="text-[17px] font-medium leading-7 text-fg">{puzzle.item.vi}</p>
        {showHint ? (
          <div className="flex items-start gap-1.5 text-xs text-fg-secondary">
            <span className="chip tone-accent shrink-0">Cấu trúc</span>
            <span className="pt-0.5">{puzzle.item.note}</span>
          </div>
        ) : (
          <button className="btn btn-ghost btn-xs -ml-2 text-fg-muted" onClick={() => setHint(true)}>
            <Icon name="sparkles" className="h-3.5 w-3.5" /> Gợi ý cấu trúc (−50% điểm câu này)
          </button>
        )}
      </div>

      {/* Answer line */}
      <div
        className={cx(
          'flex min-h-[64px] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 transition-colors',
          status === 'solved'
            ? 'border-success/50 bg-success-soft'
            : status === 'revealed'
              ? 'border-warning/50 bg-warning-soft'
              : result && !result.ok
                ? 'border-danger/40'
                : 'border-line-strong',
          shake && 'animate-shake',
        )}
      >
        {placed.length === 0 && <span className="px-1 text-sm text-fg-subtle">Bấm từng từ bên dưới theo đúng thứ tự…</span>}
        {placed.map((c, i) => {
          const mark = result && !result.ok ? result.marks[i] : null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => unplace(c.id)}
              disabled={status !== 'build'}
              className={cx(
                'animate-pop-in rounded-lg border px-3 py-1.5 text-[15px] font-medium shadow-xs transition-colors',
                status === 'solved'
                  ? 'border-success/40 bg-surface text-success-text'
                  : status === 'revealed'
                    ? 'border-warning/40 bg-surface text-warning-text'
                    : mark === true
                      ? 'border-success/50 bg-success-soft text-success-text'
                      : mark === false
                        ? 'border-danger/50 bg-danger-soft text-danger-text'
                        : 'border-accent/40 bg-accent-soft text-fg hover:border-accent',
              )}
            >
              {c.text}
            </button>
          );
        })}
      </div>

      {/* Word bank */}
      {status === 'build' && (
        <div className="flex flex-wrap gap-2">
          {puzzle.chips.map((c, i) => {
            const used = placedIds.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => place(c)}
                disabled={used}
                className={cx(
                  'relative rounded-lg border px-3 py-1.5 text-[15px] font-medium shadow-xs transition-all',
                  used
                    ? 'border-dashed border-line bg-transparent text-transparent shadow-none'
                    : 'border-line-strong bg-surface text-fg hover:-translate-y-px hover:border-accent hover:shadow-sm',
                )}
              >
                {i < 9 && !used && <span className="absolute -left-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] text-fg-muted sm:flex">{i + 1}</span>}
                {c.text}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback + actions */}
      {status === 'build' ? (
        <div className="space-y-3">
          {result && !result.ok && (
            <div className="animate-pop-in rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm">
              <div className="font-medium text-danger-text">
                Chưa đúng: {correctCount}/{placed.length} từ đúng vị trí (xanh). Sửa các từ đỏ rồi kiểm tra lại.
              </div>
              {result.usedTrap && puzzle.item.why && <div className="mt-1 text-fg-secondary">⚠️ Có từ bẫy: {puzzle.item.why}</div>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={submit} disabled={placed.length < puzzle.words}>
              <Icon name="check" /> Kiểm tra <span className="kbd ml-1 hidden border-white/30 bg-transparent text-accent-fg sm:inline-flex">↵</span>
            </button>
            <button className="btn btn-secondary" onClick={() => { setPlaced([]); setResult(null); }} disabled={!placed.length}>
              <Icon name="undo" /> Xếp lại
            </button>
            {tries >= 2 && (
              <button className="btn btn-ghost" onClick={reveal}>
                Xem đáp án
              </button>
            )}
            <span className="ml-auto hidden text-2xs text-fg-faint sm:inline">phím 1–9 chọn từ · ⌫ bỏ từ cuối · Esc xếp lại</span>
          </div>
        </div>
      ) : (
        <div className={cx('animate-pop-in rounded-lg border px-4 py-3 text-sm', status === 'solved' ? 'border-success/40 bg-success-soft' : 'border-warning/40 bg-warning-soft')}>
          <div className="flex items-start gap-2">
            <button className="btn btn-ghost btn-icon btn-xs shrink-0" onClick={() => speak(puzzle.item.s, 0.9)} title="Nghe">
              <Icon name="volume" className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-fg">{puzzle.item.s}</div>
              {puzzle.item.alt?.length ? <div className="text-xs text-fg-muted">Cũng đúng: {puzzle.item.alt.join(' · ')}</div> : null}
              <div className={cx('mt-1 text-xs', status === 'solved' ? 'text-success-text' : 'text-warning-text')}>
                {status === 'solved' ? (tries === 0 ? 'Chính xác ngay lần đầu!' : 'Đúng rồi!') : 'Đáp án đúng. Câu này sẽ vào mục Ôn lỗi sai.'}
              </div>
            </div>
            {status === 'solved' && <span className="shrink-0 text-xs font-semibold text-success-text">+{gain}</span>}
          </div>
          <div className="mt-3 flex justify-end">
            <button className="btn btn-primary" onClick={next} autoFocus>
              {idx + 1 >= puzzles.length ? 'Xem kết quả' : 'Câu tiếp'} <span className="kbd ml-1 hidden border-white/30 bg-transparent text-accent-fg sm:inline-flex">↵</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
