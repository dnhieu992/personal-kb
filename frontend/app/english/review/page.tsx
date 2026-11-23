'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  Knowledge,
  KIND_COLORS,
  KIND_LABELS,
  EnglishKind,
} from '../../lib/api';
import { Icon } from '../../components/icons';
import { Alert, EmptyState, Loading, PageHeader, ProgressBar } from '../../components/ui';

export default function EnglishReviewPage() {
  const [queue, setQueue] = useState<Knowledge[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.english
      .review(20)
      .then(setQueue)
      .catch((e) => setError((e as Error).message));
  }, []);

  async function grade(remembered: boolean) {
    if (!queue) return;
    const card = queue[index];
    try {
      await api.english.recordReview(card.id, remembered);
    } catch {
      /* non-fatal — keep the session moving */
    }
    setReviewed((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  // Space reveals, 1 = forgot, 2 = remembered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!queue || index >= queue.length || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && (e.key === '1' || e.key === '2')) grade(e.key === '2');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) return <Alert>{error}</Alert>;
  if (!queue) return <Loading label="Loading cards…" />;

  if (queue.length === 0) {
    return (
      <>
        <PageHeader title="Review" />
        <EmptyState
          icon="cards"
          title="Chưa có mục nào để ôn"
          description="Viết nhật ký hoặc lưu entry — AI sẽ nhặt ra từ vựng và ngữ pháp để ôn."
          action={
            <Link href="/english/new" className="btn btn-primary btn-sm">
              <Icon name="pen" /> Ghi buổi học đầu tiên
            </Link>
          }
        />
      </>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success-text">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.25} />
        </span>
        <h1 className="text-[22px] font-semibold text-fg">Xong rồi!</h1>
        <p className="mt-1 text-fg-muted">Bạn đã ôn {reviewed} mục.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/english" className="btn btn-secondary">
            Về nhật ký
          </Link>
          <button
            onClick={() => {
              setIndex(0);
              setReviewed(0);
              setRevealed(false);
            }}
            className="btn btn-primary"
          >
            Ôn lại
          </button>
        </div>
      </div>
    );
  }

  const card = queue[index];

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/english" className="btn btn-ghost btn-icon btn-sm" title="Thoát">
          <Icon name="x" />
        </Link>
        <ProgressBar value={index / queue.length} className="h-2" />
        <span className="shrink-0 text-[13px] tabular-nums text-fg-muted">
          {index + 1} / {queue.length}
        </span>
      </div>

      <div className="card flex min-h-[22rem] flex-col p-8 shadow-sm md:p-10">
        <div className="mb-4 flex items-center gap-2">
          {card.englishKind && <span className={`chip ${KIND_COLORS[card.englishKind as EnglishKind]}`}>{KIND_LABELS[card.englishKind as EnglishKind]}</span>}
          {card.hard && <span className="chip tone-amber">khó nhớ</span>}
        </div>
        <p className="text-xl font-medium leading-relaxed text-fg md:text-2xl">{card.content}</p>

        {revealed ? (
          <div className="mt-6 space-y-3 border-t border-line pt-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Nghĩa</span>
              {card.cefrLevel && <span className="chip tone-sky">{card.cefrLevel}</span>}
            </div>
            <p className="text-fg-secondary">{card.summary}</p>
            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-x-2">
                {card.tags.map((t) => (
                  <span key={t} className="text-xs text-fg-subtle">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-auto pt-8 text-center text-xs text-fg-subtle">Nhớ nghĩa chưa? Lật thẻ để kiểm tra.</p>
        )}
      </div>

      <div className="mt-4">
        {revealed ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => grade(false)} className="btn btn-lg border border-danger/30 bg-danger-soft text-danger-text hover:border-danger/60">
              Quên <span className="kbd ml-1">1</span>
            </button>
            <button onClick={() => grade(true)} className="btn btn-lg border border-success/30 bg-success-soft text-success-text hover:border-success/60">
              Nhớ rồi <span className="kbd ml-1">2</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn btn-primary btn-lg w-full">
            Hiện nghĩa <span className="kbd ml-1 border-white/30 bg-white/15 text-white">Space</span>
          </button>
        )}
      </div>
    </div>
  );
}
