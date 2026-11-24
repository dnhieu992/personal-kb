'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ListeningInfo, ListeningTask, SummaryGrade } from '../../../lib/api';
import { Icon } from '../../../components/icons';
import { Alert, cx, Loading } from '../../../components/ui';

/**
 * The lesson's listening task: hear a passage (browser voice, text hidden),
 * answer comprehension questions, then summarise it in English — the AI checks
 * which key ideas the summary covers; ≥ passScore % passes.
 */
export function Listening({ lessonId }: { lessonId: string }) {
  const [info, setInfo] = useState<ListeningInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api.course
      .listening(lessonId)
      .then((i) => {
        setInfo(i);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [lessonId]);

  useEffect(load, [load]);

  const generating = info?.task?.status === 'GENERATING';
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [generating, load]);

  async function generate(confirmFirst = false) {
    if (confirmFirst && !window.confirm('Tạo bài nghe mới? Bài hiện tại và điểm của nó sẽ bị thay.')) return;
    setStarting(true);
    try {
      setInfo(await api.course.generateListening(lessonId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  if (error && !info) return <Alert>{error}</Alert>;
  if (!info) return <Loading label="Đang tải bài nghe…" />;

  const { task } = info;
  if (!task || task.status === 'FAILED') {
    return (
      <div className="space-y-4">
        {task?.status === 'FAILED' && <Alert title="Tạo bài nghe bị lỗi">{task.error}</Alert>}
        <div className="card p-5">
          <p className="eyebrow mb-1">Nghe hiểu</p>
          <h2 className="text-lg font-semibold text-fg">Nghe một đoạn ~{info.targetWords} từ, trả lời câu hỏi, rồi tự tóm tắt</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-fg-secondary">
            <li>Nghe đoạn nói (chữ bị ẩn) — nghe lại, chỉnh tốc độ thoải mái.</li>
            <li>Trả lời các câu hỏi trắc nghiệm về nội dung.</li>
            <li>Tự viết tóm tắt bằng tiếng Anh — AI chấm, nêu đủ ≥ {info.passScore}% ý chính là đạt.</li>
          </ol>
          <p className="mt-3 text-[13px] text-fg-muted">
            Bài nghe được AI soạn một lần cho bài học này rồi lưu lại (khoảng 1 phút). Độ dài tăng dần theo level và vị
            trí bài: A2 100–180 từ → C1 tới 500 từ.
          </p>
          {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}
          <button
            onClick={() => generate()}
            disabled={starting || !info.enabled}
            className="btn btn-primary mt-4"
          >
            <Icon name="sparkles" /> {task ? 'Tạo lại bài nghe' : 'Tạo bài nghe'}
          </button>
          {!info.enabled && <p className="hint mt-2">AI chưa được cấu hình trên server.</p>}
        </div>
      </div>
    );
  }

  if (task.status === 'GENERATING') {
    return (
      <div className="card p-6">
        <Loading label={`AI đang soạn bài nghe ~${task.targetWords} từ… khoảng 1 phút.`} />
      </div>
    );
  }

  return (
    <ListeningTaskView
      key={task.id}
      task={task}
      info={info}
      onRegenerate={() => generate(true)}
      onGraded={load}
    />
  );
}

type Stage = 'listen' | 'questions' | 'summary';

function ListeningTaskView({
  task,
  info,
  onRegenerate,
  onGraded,
}: {
  task: ListeningTask;
  info: ListeningInfo;
  onRegenerate: () => void;
  onGraded: () => void;
}) {
  const questions = task.questions ?? [];
  const player = usePassagePlayer(task.passage ?? '');
  const [stage, setStage] = useState<Stage>(task.lastGrade ? 'summary' : 'listen');
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(!!task.lastGrade);
  const [summary, setSummary] = useState(task.lastSummary ?? '');
  const [grade, setGrade] = useState<SummaryGrade | null>(task.lastGrade);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [showText, setShowText] = useState(!!task.lastGrade);

  const correct = questions.filter((q, i) => choices[i] === q.answer).length;
  const summaryWords = (summary.match(/[\p{L}0-9'’-]+/gu) ?? []).length;
  const lo = Math.max(30, Math.round((task.wordCount * 0.2) / 10) * 10);
  const hi = lo * 2;

  async function submit() {
    if (summaryWords < info.minSummaryWords || grading) return;
    setGrading(true);
    setGradeError(null);
    try {
      const g = await api.course.gradeListening(task.lessonId, summary, checked ? correct : undefined);
      setGrade(g);
      setShowText(true);
      onGraded();
    } catch (e) {
      setGradeError((e as Error).message);
    } finally {
      setGrading(false);
    }
  }

  function retry() {
    setGrade(null);
    setSummary('');
    setChoices({});
    setChecked(false);
    setShowText(false);
    setStage('listen');
    player.stop();
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Nghe hiểu · {task.wordCount} từ</p>
            <h2 className="text-lg font-semibold text-fg">{showText ? task.title : 'Đoạn nghe'}</h2>
            {task.context && <p className="mt-1 text-sm text-fg-muted">{task.context}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {task.bestScore !== null && (
              <span className={cx('chip px-2.5 py-1 text-[13px]', task.passedAt ? 'tone-green' : 'tone-amber')}>
                {task.passedAt && <Icon name="check" className="h-3.5 w-3.5" />} Tóm tắt cao nhất {task.bestScore}%
              </span>
            )}
          </div>
        </div>

        <Player player={player} />

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <StageTab active={stage === 'listen'} onClick={() => setStage('listen')} n={1} label="Nghe" />
          <StageTab
            active={stage === 'questions'}
            onClick={() => setStage('questions')}
            n={2}
            label={`Câu hỏi${checked ? ` · ${correct}/${questions.length}` : ''}`}
          />
          <StageTab
            active={stage === 'summary'}
            onClick={() => setStage('summary')}
            n={3}
            label={`Tóm tắt${grade ? ` · ${grade.score}%` : ''}`}
          />
        </div>
      </div>

      {stage === 'listen' && (
        <div className="card p-5">
          <h3 className="section-title mb-2">Cách luyện</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg-secondary">
            <li>Lần 1: nghe hết ở tốc độ chậm, không dừng — chỉ cần nắm “ai nói, nói về chuyện gì”.</li>
            <li>Lần 2: nghe lại, ghi nháp vài từ khoá ra giấy (người, con số, việc cần làm, lý do).</li>
            <li>Trả lời câu hỏi, rồi nghe thêm lần nữa trước khi viết tóm tắt.</li>
            <li>Chữ chỉ hiện sau khi nộp tóm tắt — đừng mở sớm, đó mới là luyện nghe.</li>
          </ul>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setStage('questions')} className="btn btn-primary">
              Tiếp: Trả lời câu hỏi <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      )}

      {stage === 'questions' && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="card p-4 md:p-5">
              <p className="mb-3 text-[15px] font-medium text-fg">
                <span className="mr-2 text-fg-subtle">{i + 1}.</span>
                {q.question}
              </p>
              <div className="grid gap-2 lg:grid-cols-2">
                {q.options.map((o) => {
                  const chosen = choices[i] === o;
                  const right = checked && o === q.answer;
                  const wrong = checked && chosen && !right;
                  return (
                    <button
                      key={o}
                      disabled={checked}
                      onClick={() => setChoices((c) => ({ ...c, [i]: o }))}
                      className={cx(
                        'rounded-lg border px-3 py-2 text-left text-[14.5px] transition',
                        right
                          ? 'border-success bg-success-soft text-success-text'
                          : wrong
                            ? 'border-danger bg-danger-soft text-danger-text'
                            : chosen
                              ? 'border-accent bg-accent-soft text-fg'
                              : 'border-line-strong hover:bg-subtle',
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {checked && q.explanation && <p className="mt-3 text-[13px] text-fg-muted">{q.explanation}</p>}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {checked ? (
              <p className="text-sm text-fg-secondary">
                Đúng <b>{correct}/{questions.length}</b>. Câu sai thì nghe lại đoạn đó trước khi tóm tắt.
              </p>
            ) : (
              <p className="text-sm text-fg-muted">
                Đã chọn {Object.keys(choices).length}/{questions.length}
              </p>
            )}
            {checked ? (
              <button onClick={() => setStage('summary')} className="btn btn-primary">
                Tiếp: Tóm tắt <Icon name="arrow-right" />
              </button>
            ) : (
              <button
                onClick={() => setChecked(true)}
                disabled={Object.keys(choices).length < questions.length}
                className="btn btn-primary"
              >
                <Icon name="check" /> Kiểm tra
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'summary' && (
        <div className="space-y-4">
          <div className="card p-4 md:p-5">
            <h3 className="section-title mb-1">Tóm tắt lại bằng tiếng Anh</h3>
            <p className="mb-3 text-[13px] text-fg-muted">
              Viết bằng lời của bạn, khoảng {lo}–{hi} từ: ai nói, nói về việc gì, các ý chính và việc cần làm tiếp. Ngữ
              pháp không bị trừ điểm — AI chỉ chấm bạn có nắm đủ ý không (cần ≥ {info.passScore}% ý chính).
            </p>
            <textarea
              value={summary}
              disabled={!!grade || grading}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
              }}
              rows={7}
              placeholder="The speaker is… She explains that… First,… The team needs to…"
              className="input w-full resize-y text-[15px] leading-relaxed"
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span
                className={cx(
                  'text-xs tabular-nums',
                  summaryWords < info.minSummaryWords ? 'text-fg-subtle' : 'text-fg-muted',
                )}
              >
                {summaryWords} từ{summaryWords < info.minSummaryWords && ` · cần ít nhất ${info.minSummaryWords}`} ·
                Ctrl+Enter để nộp
              </span>
              {grade ? (
                <button onClick={retry} className="btn btn-secondary">
                  <Icon name="refresh" /> Làm lại từ đầu
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={summaryWords < info.minSummaryWords || grading}
                  className="btn btn-primary"
                >
                  <Icon name="send" /> {grading ? 'AI đang chấm…' : 'Nộp để chấm'}
                </button>
              )}
            </div>
            {gradeError && <p className="mt-2 text-sm text-danger-text">{gradeError}</p>}
          </div>

          {grade && <GradeView grade={grade} passScore={info.passScore} />}
        </div>
      )}

      <Transcript
        task={task}
        shown={showText}
        onShow={() => {
          if (
            grade ||
            window.confirm('Xem chữ trước khi tóm tắt thì không còn là luyện nghe nữa. Vẫn xem?')
          )
            setShowText(true);
        }}
        onSpeak={player.playOne}
      />

      <div className="flex justify-end">
        <button onClick={onRegenerate} className="btn btn-ghost btn-xs text-fg-subtle" title="Bài nghe có lỗi? Để AI soạn bài khác.">
          <Icon name="refresh" /> Đổi bài nghe khác
        </button>
      </div>
    </div>
  );
}

function StageTab({ active, onClick, n, label }: { active: boolean; onClick: () => void; n: number; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] transition',
        active ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:text-fg',
      )}
    >
      <span className="tabular-nums text-fg-subtle">{n}</span> {label}
    </button>
  );
}

function GradeView({ grade, passScore }: { grade: SummaryGrade; passScore: number }) {
  const mark = { covered: '✓', partial: '½', missing: '✗' } as const;
  const tone = { covered: 'text-success-text', partial: 'text-warning-text', missing: 'text-danger-text' } as const;
  return (
    <div className="card p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={cx('chip px-3 py-1 text-sm font-semibold', grade.passed ? 'tone-green' : 'tone-red')}>
          {grade.passed ? 'Đạt' : 'Chưa đạt'} · {grade.score}% ý chính
        </span>
        <span className="text-[13px] text-fg-muted">Cần ≥ {passScore}%</span>
      </div>
      {grade.feedback && <p className="mb-4 text-sm text-fg-secondary">{grade.feedback}</p>}

      <h4 className="eyebrow mb-2">Các ý chính của đoạn nghe</h4>
      <ul className="mb-4 space-y-2">
        {grade.ideas.map((i) => (
          <li key={i.index} className="flex gap-3 text-sm">
            <span className={cx('w-4 shrink-0 text-center font-bold', tone[i.status])}>{mark[i.status]}</span>
            <div>
              <p className="text-fg">{i.idea}</p>
              <p className="text-[13px] text-fg-muted">
                {i.vi}
                {i.note && <span className="italic"> — {i.note}</span>}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {grade.corrected && (
        <>
          <h4 className="eyebrow mb-1">Bài của bạn, sửa tiếng Anh</h4>
          <p className="whitespace-pre-line rounded-lg border border-line bg-subtle p-3 text-[14.5px] leading-relaxed text-fg">
            {grade.corrected}
          </p>
        </>
      )}
    </div>
  );
}

function Transcript({
  task,
  shown,
  onShow,
  onSpeak,
}: {
  task: ListeningTask;
  shown: boolean;
  onShow: () => void;
  onSpeak: (text: string) => void;
}) {
  const [vi, setVi] = useState(false);
  if (!shown) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-fg-muted">Chữ của đoạn nghe và bản dịch hiện sau khi bạn nộp tóm tắt.</p>
        <button onClick={onShow} className="btn btn-ghost btn-sm">
          <Icon name="book" /> Xem trước
        </button>
      </div>
    );
  }
  const paras = (task.passage ?? '').split(/\n\s*\n/).filter((p) => p.trim());
  const viParas = (task.translation ?? '').split(/\n\s*\n/).filter((p) => p.trim());
  const aligned = viParas.length === paras.length;
  return (
    <div className="card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="section-title">Transcript</h3>
        {task.translation && (
          <button onClick={() => setVi((v) => !v)} className="btn btn-ghost btn-xs">
            {vi ? 'Ẩn bản dịch' : 'Hiện bản dịch'}
          </button>
        )}
      </div>
      <p className="mb-3 text-[13px] text-fg-muted">Bấm vào một câu để nghe lại câu đó.</p>
      <div className="space-y-4">
        {paras.map((p, i) => (
          <div key={i} className={cx(vi && aligned && 'grid gap-3 md:grid-cols-2')}>
            <p className="text-[15px] leading-relaxed text-fg">
              {splitSentences(p).map((s, j) => (
                <span
                  key={j}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSpeak(s)}
                  onKeyDown={(e) => e.key === 'Enter' && onSpeak(s)}
                  className="cursor-pointer rounded hover:bg-accent-soft"
                >
                  {s}{' '}
                </span>
              ))}
            </p>
            {vi && aligned && <p className="text-[14px] leading-relaxed text-fg-muted">{viParas[i]}</p>}
          </div>
        ))}
        {vi && !aligned && (
          <p className="whitespace-pre-line border-t border-line pt-4 text-[14px] leading-relaxed text-fg-muted">
            {task.translation}
          </p>
        )}
      </div>
    </div>
  );
}

// --- player ---

/** Sentences of a text; browsers cut long utterances short, so the passage is read one sentence at a time. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…]["'”’)]?)\s+(?=["'“‘(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const RATES = [0.7, 0.8, 0.9, 1, 1.1];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && /natural|google|samantha/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US')
  );
}

interface PassagePlayer {
  supported: boolean;
  sentences: string[];
  index: number;
  playing: boolean;
  rate: number;
  plays: number;
  setRate: (r: number) => void;
  play: (from?: number) => void;
  pause: () => void;
  stop: () => void;
  playOne: (text: string) => void;
}

function usePassagePlayer(passage: string): PassagePlayer {
  const sentences = useMemo(() => splitSentences(passage), [passage]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(0.8);
  const [plays, setPlays] = useState(0);
  // Bumped on every start/stop so callbacks of a cancelled utterance do nothing.
  const run = useRef(0);
  const rateRef = useRef(rate);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const say = useCallback((text: string, token: number, onDone: () => void) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rateRef.current;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onend = () => token === run.current && onDone();
    u.onerror = () => token === run.current && onDone();
    window.speechSynthesis.speak(u);
  }, []);

  const play = useCallback(
    (from?: number) => {
      if (!supported || !sentences.length) return;
      window.speechSynthesis.cancel();
      const token = ++run.current;
      let i = Math.min(from ?? 0, sentences.length - 1);
      if (i === 0) setPlays((p) => p + 1);
      setPlaying(true);
      const next = () => {
        setIndex(i);
        say(sentences[i], token, () => {
          i += 1;
          if (i < sentences.length) {
            // A short breath between sentences, like a real speaker.
            setTimeout(() => token === run.current && next(), 250);
          } else {
            setPlaying(false);
            setIndex(0);
          }
        });
      };
      next();
    },
    [supported, sentences, say],
  );

  const pause = useCallback(() => {
    run.current++;
    if (supported) window.speechSynthesis.cancel();
    setPlaying(false);
  }, [supported]);

  const stop = useCallback(() => {
    pause();
    setIndex(0);
  }, [pause]);

  const playOne = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const token = ++run.current;
      setPlaying(false);
      say(text, token, () => {});
    },
    [supported, say],
  );

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
  }, []);

  useEffect(
    () => () => {
      run.current++;
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    },
    [],
  );

  return { supported, sentences, index, playing, rate, plays, setRate, play, pause, stop, playOne };
}

function Player({ player }: { player: PassagePlayer }) {
  const { sentences, index, playing, rate, plays } = player;
  if (!player.supported) {
    return <Alert tone="warning" className="mt-4">Trình duyệt này không đọc được tiếng Anh (Web Speech). Thử Chrome hoặc Edge.</Alert>;
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <button onClick={player.pause} className="btn btn-primary">
            <span className="text-base leading-none">❚❚</span> Tạm dừng
          </button>
        ) : (
          <button onClick={() => player.play(index)} className="btn btn-primary">
            <Icon name="play" /> {index > 0 ? 'Nghe tiếp' : plays > 0 ? 'Nghe lại' : 'Bắt đầu nghe'}
          </button>
        )}
        <button
          onClick={() => player.play(Math.max(0, index - 1))}
          className="btn btn-secondary"
          title="Lùi về câu trước"
          disabled={index === 0 && !playing}
        >
          <Icon name="chevron-left" /> Câu trước
        </button>
        <button onClick={() => player.play(0)} className="btn btn-ghost" title="Nghe lại từ đầu">
          <Icon name="refresh" /> Từ đầu
        </button>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Tốc độ đọc">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => player.setRate(r)}
              className={cx('btn btn-xs tabular-nums', r === rate ? 'btn-secondary' : 'btn-ghost text-fg-muted')}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-0.5" aria-label={`Câu ${index + 1}/${sentences.length}`}>
        {sentences.map((_, i) => (
          <button
            key={i}
            onClick={() => player.play(i)}
            title={`Nghe từ câu ${i + 1}`}
            className={cx(
              'h-2 flex-1 rounded-sm transition',
              playing && i === index ? 'bg-accent' : i < index ? 'bg-accent/40' : 'bg-line hover:bg-line-strong',
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-fg-subtle tabular-nums">
        Câu {Math.min(index + 1, sentences.length)}/{sentences.length} · đã nghe hết {plays} lượt · bấm vào thanh để
        nghe từ một câu bất kỳ
      </p>
    </div>
  );
}
