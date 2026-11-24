'use client';

import { useCallback, useEffect, useState } from 'react';
import { speak } from '../../../lib/course';
import { Icon } from '../../../components/icons';
import { cx, PageHeader } from '../../../components/ui';
import { Progress, streakAlive } from '../progress';
import { sentenceByKey, sentenceKey, WORLDS } from './data';
import {
  isUnlocked,
  LevelDef,
  levelDef,
  LEVELS_PER_WORLD,
  loadProgress,
  mistakeKeys,
  nextLevel,
  recordRound,
  reviewDef,
  saveProgress,
  worldStars,
} from './engine';
import { SentenceGame, SentenceOutcome } from './game';

type View =
  | { kind: 'map' }
  | { kind: 'play'; def: LevelDef; n: number }
  | { kind: 'result'; outcome: SentenceOutcome; newBest: boolean };

const TOTAL = WORLDS.reduce((a, w) => a + w.items.length, 0);
const MAX_STARS = WORLDS.length * LEVELS_PER_WORLD * 3;

export default function SentenceGamePage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [view, setView] = useState<View>({ kind: 'map' });
  useEffect(() => setProgress(loadProgress()), []);

  const update = useCallback((p: Progress) => {
    setProgress(p);
    saveProgress(p);
  }, []);

  const play = useCallback((def: LevelDef) => {
    setView((v) => ({ kind: 'play', def, n: (v.kind === 'play' ? v.n : 0) + 1 }));
    window.scrollTo({ top: 0 });
  }, []);

  const onDone = useCallback(
    (o: SentenceOutcome) => {
      const { progress: next, newBest } = recordRound(loadProgress(), {
        levelId: o.def.id,
        won: o.won,
        score: o.score,
        stars: o.stars,
        clean: o.clean,
        missed: o.missed,
        matched: o.solved,
      });
      update(next);
      setView({ kind: 'result', outcome: o, newBest });
      window.scrollTo({ top: 0 });
    },
    [update],
  );

  if (!progress) return null;

  if (view.kind === 'play')
    return (
      <SentenceGame
        key={view.n}
        def={view.def}
        sound={progress.sound}
        onToggleSound={() => update({ ...progress, sound: !progress.sound })}
        onDone={onDone}
        onExit={() => setView({ kind: 'map' })}
      />
    );

  if (view.kind === 'result')
    return (
      <Result
        outcome={view.outcome}
        newBest={view.newBest}
        progress={progress}
        onReplay={() => play(view.outcome.def.id === 'review' ? reviewDef(mistakeKeys(progress)) : view.outcome.def)}
        onPlay={play}
        onMap={() => setView({ kind: 'map' })}
      />
    );

  return <WorldMap progress={progress} onPlay={play} />;
}

function WorldMap({ progress, onPlay }: { progress: Progress; onPlay: (d: LevelDef) => void }) {
  const stars = WORLDS.reduce((a, _, w) => a + worldStars(progress, w), 0);
  const learned = Object.keys(progress.learned).filter((k) => sentenceByKey(k)).length;
  const mistakes = mistakeKeys(progress);
  const next = nextLevel(progress);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nối từ"
        description="Đọc nghĩa tiếng Việt, chọn từng từ theo đúng thứ tự để thành câu tiếng Anh đúng ngữ pháp. Câu dài dần, gợi ý ít dần, có từ bẫy và đồng hồ."
        back={{ href: '/english/games', label: 'Games' }}
        actions={
          <>
            {mistakes.length > 0 && (
              <button className="btn btn-secondary" onClick={() => onPlay(reviewDef(mistakes))}>
                <Icon name="refresh" /> Ôn lỗi sai
                <span className="chip tone-red -mr-1 px-1.5">{mistakes.length}</span>
              </button>
            )}
            {next && (
              <button className="btn btn-primary" onClick={() => onPlay(levelDef(next.w, next.i))}>
                <Icon name="play" /> {stars ? 'Chơi tiếp' : 'Bắt đầu'}
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="star" label="Sao" value={`${stars}/${MAX_STARS}`} />
        <Stat icon="book" label="Câu đã xếp" value={`${learned}/${TOTAL}`} />
        <Stat icon="flame" label="Chuỗi ngày" value={streakAlive(progress) ? `${progress.streak.days} ngày` : '—'} />
        <Stat icon="alert" label="Câu cần ôn" value={String(mistakes.length)} />
      </div>

      <details className="card px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium text-fg">Cách chơi</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-secondary">
          <li>Đọc câu tiếng Việt, bấm lần lượt các từ để xếp thành câu tiếng Anh. Bấm vào từ đã xếp để bỏ ra. Bàn phím: 1–9 chọn từ, ⌫ bỏ từ cuối, Enter kiểm tra.</li>
          <li>Sai mất 1 tim; từ đúng vị trí hiện xanh, sai vị trí hiện đỏ. Sai 2 lần thì được xem đáp án (câu đó vào mục ôn).</li>
          <li>Màn 1–2: từ còn viết hoa và dấu câu (biết từ nào đứng đầu, đứng cuối), có sẵn gợi ý cấu trúc.</li>
          <li>Từ màn 3: bỏ viết hoa và dấu câu, có <b>từ bẫy</b> (thừa một từ sai ngữ pháp, phải bỏ lại), gợi ý mất nửa điểm.</li>
          <li>Màn 4 và trùm: có đồng hồ, chỉ chạy khi bạn đang xếp. Xếp đúng liên tiếp thì combo tăng điểm. Không sai lần nào được 3 sao.</li>
        </ul>
      </details>

      <div className="space-y-4">
        {WORLDS.map((world, w) => {
          const open = isUnlocked(progress, w, 0);
          const done = world.items.filter((_, i) => progress.learned[sentenceKey(w, i)]);
          return (
            <section key={world.id} className={cx('card p-4 sm:p-5', !open && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Thế giới {w + 1}</span>
                    <span className={`chip tone-${world.tone}`}>{world.cefr}</span>
                    {!open && <Icon name="lock" className="h-3.5 w-3.5 text-fg-muted" />}
                  </div>
                  <h2 className="mt-1 text-[15px] font-semibold text-fg">{world.title}</h2>
                  <p className="text-[13px] text-fg-muted">{open ? world.vi : `Qua màn trùm của thế giới ${w} để mở khoá.`}</p>
                </div>
                <div className="flex items-center gap-1 text-sm text-fg-muted">
                  <Icon name="star" className="h-4 w-4 fill-current text-warning" /> {worldStars(progress, w)}/{LEVELS_PER_WORLD * 3}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
                  const def = levelDef(w, i);
                  const unlocked = isUnlocked(progress, w, i);
                  const rec = progress.levels[def.id];
                  const isNext = next?.w === w && next.i === i;
                  return (
                    <button
                      key={i}
                      disabled={!unlocked}
                      onClick={() => onPlay(def)}
                      title={`${def.name}: ${def.take} câu${def.hard ? ', không gợi ý chữ hoa' : ''}${def.trapRate ? ', có từ bẫy' : ''}${def.timed ? ', tính giờ' : ''}`}
                      className={cx(
                        'flex flex-col items-center gap-1 rounded-xl border px-1 py-3 text-center transition-all',
                        !unlocked
                          ? 'cursor-not-allowed border-dashed border-line text-fg-faint'
                          : isNext
                            ? 'border-accent bg-accent-soft text-fg ring-2 ring-accent/30 hover:-translate-y-px'
                            : 'border-line bg-surface text-fg hover:-translate-y-px hover:shadow-sm',
                      )}
                    >
                      <span
                        className={cx(
                          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
                          def.boss ? 'bg-warning-soft text-warning-text' : rec?.stars ? 'bg-success-soft text-success-text' : 'bg-muted text-fg-muted',
                        )}
                      >
                        {!unlocked ? <Icon name="lock" className="h-4 w-4" /> : def.boss ? '👑' : i + 1}
                      </span>
                      <span className="hidden text-2xs font-medium sm:block">{def.name}</span>
                      <Stars n={rec?.stars ?? 0} />
                      <span className="text-2xs text-fg-subtle">
                        {def.take} câu{def.timed ? ' · ⏱' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {done.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer select-none text-fg-muted">
                    Sổ tay: {done.length}/{world.items.length} câu đã xếp
                  </summary>
                  <ul className="mt-2 divide-y divide-line">
                    {world.items.map((it, i) => {
                      const key = sentenceKey(w, i);
                      if (!progress.learned[key]) return null;
                      return (
                        <li key={key} className="flex items-start gap-2 py-2">
                          <SpeakButton text={it.s} />
                          <SentenceLine s={it.s} vi={it.vi} note={it.note} />
                          {progress.mistakes[key] && <span className="chip tone-red shrink-0">cần ôn</span>}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Result({
  outcome,
  newBest,
  progress,
  onReplay,
  onPlay,
  onMap,
}: {
  outcome: SentenceOutcome;
  newBest: boolean;
  progress: Progress;
  onReplay: () => void;
  onPlay: (d: LevelDef) => void;
  onMap: () => void;
}) {
  const { def, won } = outcome;
  const isReview = def.id === 'review';
  const nextDef =
    won && !isReview
      ? def.index + 1 < LEVELS_PER_WORLD
        ? levelDef(def.world, def.index + 1)
        : def.world + 1 < WORLDS.length
          ? levelDef(def.world + 1, 0)
          : null
      : null;
  const left = mistakeKeys(progress).length;
  const title = won ? (outcome.stars === 3 ? 'Hoàn hảo!' : 'Qua màn!') : outcome.timeUp ? 'Hết giờ!' : 'Hết tim rồi!';
  const missed = new Set(outcome.missed);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card animate-pop-in px-6 py-8 text-center">
        <div className="eyebrow">{isReview ? 'Ôn lỗi sai' : `${WORLDS[def.world].title} · ${def.name}`}</div>
        <h1 className="mt-2 text-[26px] font-semibold text-fg">{title}</h1>
        {won && (
          <div className="mt-3 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <Icon key={i} name="star" className={cx('h-9 w-9', i < outcome.stars ? 'fill-current text-warning' : 'text-fg-faint')} />
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-fg-muted">
          <span>
            <b className="text-lg text-fg">{outcome.score}</b> điểm{newBest && <span className="chip tone-amber ml-2">Kỷ lục mới</span>}
          </span>
          <span>
            Đúng {outcome.solved.length}/{outcome.puzzles.length} câu
          </span>
          <span>Sai {outcome.wrong.length} lần</span>
          <span>Combo cao nhất x{outcome.maxCombo}</span>
          {outcome.timeBonus > 0 && <span>Thưởng thời gian +{outcome.timeBonus}</span>}
        </div>
        {!won && <p className="mt-3 text-sm text-fg-secondary">Đọc lại các câu bên dưới, để ý cấu trúc rồi thử lại.</p>}
        {isReview && won && <p className="mt-3 text-sm text-fg-secondary">{left ? `Còn ${left} câu cần ôn.` : 'Bạn đã sửa hết các câu sai. 🎉'}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn btn-secondary" onClick={onMap}>
            Về bản đồ
          </button>
          {(!isReview || left > 0) && (
            <button className={cx('btn', nextDef ? 'btn-secondary' : 'btn-primary')} onClick={onReplay}>
              <Icon name="refresh" /> Chơi lại
            </button>
          )}
          {nextDef && (
            <button className="btn btn-primary" onClick={() => onPlay(nextDef)}>
              Màn tiếp <Icon name="play" />
            </button>
          )}
        </div>
      </div>

      {outcome.wrong.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Chỗ bạn xếp sai</h2>
          <ul className="card divide-y divide-line">
            {outcome.wrong.map((w, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <div className="text-danger-text line-through decoration-1">{w.text}</div>
                <div className="mt-0.5 text-fg">→ {sentenceByKey(w.key)?.item.s}</div>
                {w.why && <div className="mt-0.5 text-fg-secondary">{w.why}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Các câu trong màn này</h2>
        <ul className="card divide-y divide-line">
          {outcome.puzzles.map((p) => (
            <li key={p.key} className="flex items-start gap-2 px-4 py-3 text-sm">
              <SpeakButton text={p.item.s} />
              <SentenceLine s={p.item.s} vi={p.item.vi} note={p.item.note} />
              {outcome.revealed.includes(p.key) ? (
                <span className="chip tone-red shrink-0">xem đáp án</span>
              ) : missed.has(p.key) ? (
                <span className="chip tone-amber shrink-0">sai rồi sửa</span>
              ) : outcome.solved.includes(p.key) ? (
                <span className="chip tone-green shrink-0">đúng</span>
              ) : (
                <span className="chip tone-gray shrink-0">chưa làm</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SentenceLine({ s, vi, note }: { s: string; vi: string; note: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-fg">{s}</div>
      <div className="text-xs text-fg-muted">{vi}</div>
      <div className="mt-0.5 text-xs text-fg-secondary">{note}</div>
    </div>
  );
}

function SpeakButton({ text }: { text: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon btn-xs shrink-0" onClick={() => speak(text, 0.9)} title="Nghe">
      <Icon name="volume" className="h-3.5 w-3.5" />
    </button>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-px">
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" className={cx('h-3 w-3', i < n ? 'fill-current text-warning' : 'text-fg-faint')} />
      ))}
    </span>
  );
}

function Stat({ icon, label, value }: { icon: 'star' | 'book' | 'flame' | 'alert'; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <Icon name={icon} className="h-4 w-4 text-fg-muted" />
      <div>
        <div className="text-2xs text-fg-muted">{label}</div>
        <div className="text-sm font-semibold tabular-nums text-fg">{value}</div>
      </div>
    </div>
  );
}
