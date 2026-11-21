'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, LessonDetail } from '../../../lib/api';
import { speak } from '../../../lib/course';
import { Icon } from '../../../components/icons';
import { Alert, cx, Loading, PageHeader } from '../../../components/ui';
import { Practice } from './practice';

type Tab = 'theory' | 'vocab' | 'practice';

export default function LessonPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('theory');

  const load = useCallback(() => {
    api.course
      .lesson(params.id)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  useEffect(() => {
    setData(null);
    setTab('theory');
    load();
  }, [load]);

  // A lesson being (re)written: check back until it is ready.
  const pending = data && (data.lesson.status === 'PENDING' || data.lesson.status === 'GENERATING');
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [pending, load]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading label="Đang tải bài học…" />;

  const { lesson, unit } = data;
  const back = { href: `/english?level=${lesson.level}`, label: 'English for IT' };

  async function regenerate() {
    if (!window.confirm('Soạn lại bài này bằng AI? Nội dung hiện tại sẽ được thay (điểm của bạn vẫn giữ).')) return;
    await api.course.regenerate(lesson.id).catch((e) => setError((e as Error).message));
    load();
  }

  const header = (
    <PageHeader
      back={back}
      title={lesson.title}
      description={
        <>
          {lesson.level} · Unit {unit?.position} — {unit?.title} · Bài {data.index}/{data.total}
        </>
      }
      actions={
        <>
          {lesson.bestScore !== null && (
            <span className={cx('chip px-2.5 py-1 text-[13px]', lesson.completedAt ? 'tone-green' : 'tone-amber')}>
              {lesson.completedAt && <Icon name="check" className="h-3.5 w-3.5" />} Cao nhất {lesson.bestScore}%
            </span>
          )}
          <span className="chip tone-gray px-2.5 py-1 text-[13px]">
            <Icon name="clock" className="h-3.5 w-3.5" /> {lesson.minutes} phút
          </span>
        </>
      }
    />
  );

  if (data.locked) {
    return (
      <>
        {header}
        <Alert tone="warning" title="Bài này chưa mở">
          Hoàn thành bài trước (đạt ≥ {data.passScore}%) để mở khóa.{' '}
          {data.prevId && (
            <Link href={`/english/lesson/${data.prevId}`} className="underline">
              Đến bài trước
            </Link>
          )}
        </Alert>
      </>
    );
  }

  if (lesson.status !== 'READY') {
    return (
      <>
        {header}
        {lesson.status === 'FAILED' ? (
          <Alert title="Soạn bài bị lỗi">
            {lesson.error}
            <div className="mt-3">
              <button onClick={regenerate} className="btn btn-secondary btn-sm">
                <Icon name="refresh" /> Soạn lại
              </button>
            </div>
          </Alert>
        ) : (
          <div className="card p-6">
            <Loading label="AI đang soạn bài này… khoảng 1 phút." />
          </div>
        )}
      </>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'theory', label: '1. Kiến thức' },
    { id: 'vocab', label: '2. Từ vựng', count: lesson.vocab?.length },
    { id: 'practice', label: '3. Luyện tập', count: lesson.exercises?.length },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      {header}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition',
              tab === t.id ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1.5 text-xs text-fg-subtle">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'theory' && (
        <div className="space-y-6">
          <div className="card p-4">
            <p className="eyebrow mb-1">Mục tiêu</p>
            <p className="text-sm text-fg-secondary">{lesson.objective}</p>
            {lesson.intro && <p className="mt-2 text-sm text-fg-muted">{lesson.intro}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip tone-violet">{lesson.grammar}</span>
              <span className="chip tone-sky">{lesson.vocabTheme}</span>
            </div>
          </div>

          <article className="prose-kb card p-5 text-[14.5px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.theory ?? ''}</ReactMarkdown>
          </article>

          {!!lesson.phrases?.length && (
            <section>
              <h2 className="section-title mb-3">Mẫu câu dùng ngay</h2>
              <ul className="card divide-y divide-line">
                {lesson.phrases.map((p) => (
                  <li key={p.en} className="flex items-start gap-3 p-3">
                    <SpeakButton text={p.en} />
                    <div>
                      <p className="text-sm font-medium text-fg">{p.en}</p>
                      <p className="text-[13px] text-fg-muted">{p.vi}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex justify-end">
            <button onClick={() => setTab('vocab')} className="btn btn-primary">
              Tiếp: Từ vựng <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      )}

      {tab === 'vocab' && (
        <div className="space-y-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {(lesson.vocab ?? []).map((v) => (
              <li key={v.word} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-fg">{v.word}</p>
                    <p className="text-xs text-fg-subtle">
                      {v.ipa} · <span className="italic">{v.pos}</span>
                    </p>
                  </div>
                  <SpeakButton text={v.word} />
                </div>
                <p className="mt-2 text-sm text-fg-secondary">{v.meaning}</p>
                <button
                  onClick={() => speak(v.example)}
                  className="mt-1 text-left text-[13px] italic text-fg-muted hover:text-fg"
                  title="Nghe câu ví dụ"
                >
                  “{v.example}”
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <button onClick={() => setTab('theory')} className="btn btn-ghost">
              <Icon name="chevron-left" /> Kiến thức
            </button>
            <button onClick={() => setTab('practice')} className="btn btn-primary">
              Tiếp: Luyện tập <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      )}

      {tab === 'practice' && (
        <Practice
          key={lesson.id}
          detail={data}
          onFinished={load}
          onReview={() => setTab('theory')}
        />
      )}

      <div className="mt-12 flex items-center justify-between border-t border-line pt-4 text-[13px]">
        {data.prevId ? (
          <Link href={`/english/lesson/${data.prevId}`} className="link">
            ← Bài trước
          </Link>
        ) : (
          <span />
        )}
        <button onClick={regenerate} className="btn btn-ghost btn-xs text-fg-subtle" title="Nội dung có lỗi? Để AI soạn lại.">
          <Icon name="refresh" /> Soạn lại bài
        </button>
      </div>
    </div>
  );
}

function SpeakButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => speak(text)}
      className="btn btn-ghost btn-icon btn-sm shrink-0 text-fg-muted"
      title="Nghe phát âm"
      aria-label={`Nghe: ${text}`}
    >
      <Icon name="volume" />
    </button>
  );
}
