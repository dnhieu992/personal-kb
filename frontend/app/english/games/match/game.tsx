'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { speak } from '../../../lib/course';
import { Icon } from '../../../components/icons';
import { cx } from '../../../components/ui';
import { pairByKey, spoken } from './data';
import { buildRound, comboMultiplier, LevelDef, RoundItem, RoundResult, starsFor } from './engine';

export interface WrongPick {
  l: string;
  r: string;
  why?: string;
}

export interface GameOutcome extends RoundResult {
  items: RoundItem[];
  wrong: WrongPick[];
  timeUp: boolean;
  maxCombo: number;
  timeBonus: number;
}

type Feedback = { ok: true; item: RoundItem; gain: number } | { ok: false; pick: WrongPick };

const LETTERS = 'ABCDEFGHIJ';

/**
 * One round: pick a card on the left, then its partner on the right (or the
 * other way). Every match shows the whole sentence with its meaning and rule and
 * reads it aloud, so you learn while you score. Wrong picks cost a heart; traps
 * explain why they're wrong.
 */
export function MatchGame({
  def,
  sound,
  onToggleSound,
  onDone,
  onExit,
}: {
  def: LevelDef;
  sound: boolean;
  onToggleSound: () => void;
  onDone: (o: GameOutcome) => void;
  onExit: () => void;
}) {
  const [round] = useState(() => buildRound(def));
  const { items, left, right } = round;

  const [doneL, setDoneL] = useState<Set<string>>(new Set());
  const [doneR, setDoneR] = useState<Set<string>>(new Set());
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [shake, setShake] = useState<string[]>([]);
  const [hearts, setHearts] = useState(def.hearts);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(def.timer ?? 0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const missed = useRef<Set<number>>(new Set());
  const wrong = useRef<WrongPick[]>([]);
  const finished = useRef(false);

  const finish = useCallback(
    (won: boolean, opts: { score: number; order: number[]; timeLeft: number; maxCombo: number }) => {
      if (finished.current) return;
      finished.current = true;
      const timeBonus = won && def.timer ? opts.timeLeft * 5 : 0;
      const matched = opts.order.map((i) => items[i].key);
      onDone({
        def,
        won,
        score: opts.score + timeBonus,
        stars: won ? starsFor(wrong.current.length) : 0,
        clean: opts.order.filter((i) => !missed.current.has(i)).map((i) => items[i].key),
        missed: [...missed.current].map((i) => items[i].key),
        matched,
        items,
        wrong: wrong.current,
        timeUp: !won && opts.timeLeft <= 0,
        maxCombo: opts.maxCombo,
        timeBonus,
      });
    },
    [def, items, onDone],
  );

  // Clock.
  const live = useRef({ score, order, maxCombo });
  live.current = { score, order, maxCombo };
  useEffect(() => {
    if (!def.timer) return;
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
  }, [def.timer, finish]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const evaluate = useCallback(
    (lId: string, rId: string) => {
      const lc = left.find((c) => c.id === lId)!;
      const rc = right.find((c) => c.id === rId)!;
      setSelL(null);
      setSelR(null);
      // Correct if this left text and right text form any unmatched pair (handles duplicate lefts).
      const hit = items.findIndex(
        (it, i) => it.pair.l === lc.text && it.pair.r === rc.text && !order.includes(i),
      );
      if (hit >= 0) {
        const nextCombo = combo + 1;
        const gain = Math.round(100 * comboMultiplier(nextCombo));
        const nextOrder = [...order, hit];
        const nextScore = score + gain;
        const nextMax = Math.max(maxCombo, nextCombo);
        setDoneL((s) => new Set(s).add(lId));
        setDoneR((s) => new Set(s).add(rId));
        setCombo(nextCombo);
        setMaxCombo(nextMax);
        setScore(nextScore);
        setOrder(nextOrder);
        setFeedback({ ok: true, item: items[hit], gain });
        if (sound) speak(spoken(items[hit].kind, items[hit].pair), 0.92);
        if (nextOrder.length === items.length)
          setTimeout(() => finish(true, { score: nextScore, order: nextOrder, timeLeft, maxCombo: nextMax }), 900);
        return;
      }
      const trapWhy = rc.trapOf ? pairByKey(rc.trapOf)?.pair.why : undefined;
      const why = trapWhy ? `Thẻ bẫy, không ghép với vế nào. ${trapWhy}` : undefined;
      const pick = { l: lc.text, r: rc.text, why };
      missed.current.add(lc.item);
      wrong.current = [...wrong.current, pick];
      setCombo(0);
      setShake([lId, rId]);
      setTimeout(() => setShake([]), 420);
      setFeedback({ ok: false, pick });
      const h = hearts - 1;
      setHearts(h);
      if (h <= 0) setTimeout(() => finish(false, { score, order, timeLeft, maxCombo }), 700);
    },
    [left, right, items, order, combo, score, maxCombo, sound, hearts, timeLeft, finish],
  );

  const pickLeft = useCallback(
    (id: string) => {
      if (finished.current || doneL.has(id)) return;
      if (selR) evaluate(id, selR);
      else setSelL((s) => (s === id ? null : id));
    },
    [doneL, selR, evaluate],
  );
  const pickRight = useCallback(
    (id: string) => {
      if (finished.current || doneR.has(id)) return;
      if (selL) evaluate(selL, id);
      else setSelR((s) => (s === id ? null : id));
    },
    [doneR, selL, evaluate],
  );

  // Keyboard: 1–9 left, A–J right, Esc clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setSelL(null);
        setSelR(null);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= left.length) return pickLeft(left[n - 1].id);
      const li = LETTERS.indexOf(e.key.toUpperCase());
      if (li >= 0 && li < right.length) pickRight(right[li].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [left, right, pickLeft, pickRight]);

  const pct = def.timer ? timeLeft / def.timer : 1;
  const mult = comboMultiplier(Math.max(1, combo));

  return (
    <div className="space-y-4">
      {/* HUD */}
      <div className="card sticky top-2 z-10 space-y-2 px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button className="btn btn-ghost btn-sm -ml-2" onClick={onExit} title="Thoát">
            <Icon name="chevron-left" /> Thoát
          </button>
          <div className="min-w-[120px] flex-1">
            <div className="truncate text-sm font-semibold text-fg">
              {def.boss && '👑 '}
              {def.name}
            </div>
            <div className="text-2xs text-fg-muted">
              {order.length}/{items.length} cặp{def.decoys ? ` · ${def.decoys} bẫy` : ''}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-0.5" title={`${hearts} mạng`}>
              {Array.from({ length: def.hearts }, (_, i) => (
                <Icon
                  key={i}
                  name="heart"
                  className={cx('h-4 w-4 transition-colors', i < hearts ? 'fill-current text-danger' : 'text-fg-faint')}
                />
              ))}
            </div>
            <span className={cx('chip tabular-nums', combo >= 2 ? 'tone-orange' : 'tone-gray')} title="Combo">
              <Icon name="flame" className="h-3.5 w-3.5" /> x{mult}
            </span>
            <span className="text-sm font-semibold tabular-nums text-fg">{score} đ</span>
            {def.timer && (
              <span className={cx('flex items-center gap-1 text-sm tabular-nums', pct < 0.25 ? 'font-semibold text-danger-text' : 'text-fg-muted')}>
                <Icon name="clock" className="h-3.5 w-3.5" /> {timeLeft}s
              </span>
            )}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onToggleSound} title={sound ? 'Tắt đọc to' : 'Bật đọc to'}>
              <Icon name="volume" className={cx(!sound && 'opacity-40')} />
            </button>
          </div>
        </div>
        {def.timer && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-emphasis">
            <div
              className={cx('h-full rounded-full transition-all duration-1000 ease-linear', pct < 0.25 ? 'bg-danger' : pct < 0.5 ? 'bg-warning' : 'bg-accent')}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Board */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Column label="Vế đầu" hint="1–9">
          {left.map((c, i) => (
            <CardButton
              key={c.id}
              text={c.text}
              badge={String(i + 1)}
              selected={selL === c.id}
              done={doneL.has(c.id)}
              shake={shake.includes(c.id)}
              onClick={() => pickLeft(c.id)}
            />
          ))}
        </Column>
        <Column label={def.kind === 'vocab' ? 'Nghĩa' : 'Vế sau'} hint="A–J">
          {right.map((c, i) => (
            <CardButton
              key={c.id}
              text={c.text}
              badge={LETTERS[i]}
              selected={selR === c.id}
              done={doneR.has(c.id)}
              shake={shake.includes(c.id)}
              onClick={() => pickRight(c.id)}
            />
          ))}
        </Column>
      </div>

      <FeedbackPanel feedback={feedback} />

      {order.length > 1 && (
        <details className="card px-4 py-3 text-sm">
          <summary className="cursor-pointer select-none text-fg-muted">Đã ghép trong màn này ({order.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {[...order].reverse().map((i) => (
              <li key={i} className="flex items-start gap-2">
                <SpeakButton text={spoken(items[i].kind, items[i].pair)} />
                <Full item={items[i]} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Column({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="eyebrow">{label}</span>
        <span className="hidden text-2xs text-fg-faint sm:inline">phím {hint}</span>
      </div>
      {children}
    </div>
  );
}

function CardButton({
  text,
  badge,
  selected,
  done,
  shake,
  onClick,
}: {
  text: string;
  badge: string;
  selected: boolean;
  done: boolean;
  shake: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={done}
      className={cx(
        'flex min-h-[48px] w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm shadow-xs transition-all',
        done
          ? 'animate-match-out cursor-default border-success/40 bg-success-soft text-success-text opacity-60'
          : shake
            ? 'animate-shake border-danger bg-danger-soft text-danger-text'
            : selected
              ? 'border-accent bg-accent-soft text-fg ring-2 ring-accent/40'
              : 'border-line bg-surface text-fg hover:-translate-y-px hover:border-line-strong hover:shadow-sm',
      )}
    >
      <span className={cx('kbd hidden shrink-0 sm:inline-flex', selected && 'border-accent text-accent-text')}>
        {done ? <Icon name="check" className="h-3 w-3" /> : badge}
      </span>
      <span className="min-w-0 break-words">{text}</span>
    </button>
  );
}

function FeedbackPanel({ feedback }: { feedback: Feedback | null }) {
  if (!feedback)
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-fg-muted">
        Chọn một thẻ bên trái rồi chọn thẻ hợp với nó bên phải. Mỗi cặp ghép đúng sẽ hiện cả câu, nghĩa và cấu trúc để bạn học luôn.
      </div>
    );
  if (!feedback.ok)
    return (
      <div key={feedback.pick.l + feedback.pick.r} className="animate-pop-in rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm">
        <div className="flex items-start gap-2 text-danger-text">
          <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <div className="line-through decoration-1">
              {feedback.pick.l} {feedback.pick.r}
            </div>
            <div className="text-fg-secondary">{feedback.pick.why ?? 'Chưa khớp. Đọc lại cả câu xem có tự nhiên không, rồi thử lại nhé.'}</div>
          </div>
        </div>
      </div>
    );
  const { item, gain } = feedback;
  return (
    <div key={item.key} className="animate-pop-in rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <SpeakButton text={spoken(item.kind, item.pair)} />
        <div className="min-w-0 flex-1 space-y-1">
          <Full item={item} big />
          {item.pair.note && (
            <div className="flex items-start gap-1.5 text-xs text-fg-secondary">
              <span className="chip tone-accent shrink-0">Cấu trúc</span>
              <span className="pt-0.5">{item.pair.note}</span>
            </div>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-success-text">+{gain}</span>
      </div>
    </div>
  );
}

/** A matched pair written out in full: the sentence (answer part highlighted) and its meaning. */
export function Full({ item, big }: { item: RoundItem; big?: boolean }) {
  const { pair, kind } = item;
  if (kind === 'vocab')
    return (
      <div className="min-w-0">
        <div className={cx('text-fg', big && 'text-[15px]')}>
          <b>{pair.l}</b> <span className="text-fg-muted">·</span> {pair.r}
        </div>
        {pair.ex && <div className="text-xs italic text-fg-muted">{pair.ex}</div>}
      </div>
    );
  return (
    <div className="min-w-0">
      <div className={cx('text-fg', big && 'text-[15px]')}>
        {kind === 'qa' ? (
          <>
            <span className="text-fg-muted">A:</span> {pair.l} <br />
            <span className="text-fg-muted">B:</span> <b>{pair.r}</b>
          </>
        ) : (
          <>
            {pair.l} <b className="text-accent-text">{pair.r}</b>
          </>
        )}
      </div>
      {pair.vi && <div className="text-xs text-fg-muted">{pair.vi}</div>}
    </div>
  );
}

export function SpeakButton({ text }: { text: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon btn-xs shrink-0" onClick={() => speak(text, 0.92)} title="Nghe">
      <Icon name="volume" className="h-3.5 w-3.5" />
    </button>
  );
}

