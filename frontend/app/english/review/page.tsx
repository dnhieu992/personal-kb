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

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!queue) {
    return <p className="text-sm text-slate-500">Loading cards…</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-slate-600">Chưa có mục nào để ôn.</p>
        <Link href="/english/new" className="text-indigo-600 underline">
          Ghi buổi học đầu tiên
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Xong! 🎉</h1>
        <p className="text-slate-600">Bạn đã ôn {reviewed} mục.</p>
        <div className="flex justify-center gap-3">
          <Link
            href="/english"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Về nhật ký
          </Link>
          <button
            onClick={() => {
              setIndex(0);
              setReviewed(0);
              setRevealed(false);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Ôn lại
          </button>
        </div>
      </div>
    );
  }

  const card = queue[index];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Thẻ {index + 1} / {queue.length}
        </span>
        <Link href="/english" className="text-indigo-600 hover:underline">
          Thoát
        </Link>
      </div>

      <div className="min-h-[14rem] rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          {card.englishKind && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                KIND_COLORS[card.englishKind as EnglishKind]
              }`}
            >
              {KIND_LABELS[card.englishKind as EnglishKind]}
            </span>
          )}
          {card.hard && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              khó nhớ
            </span>
          )}
        </div>
        <p className="text-xl font-medium leading-relaxed">{card.content}</p>

        {revealed && (
          <div className="mt-6 space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase text-slate-400">
                Nghĩa
              </span>
              {card.cefrLevel && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {card.cefrLevel}
                </span>
              )}
            </div>
            <p className="text-slate-700">{card.summary}</p>
            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {revealed ? (
        <div className="flex gap-3">
          <button
            onClick={() => grade(false)}
            className="flex-1 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Quên
          </button>
          <button
            onClick={() => grade(true)}
            className="flex-1 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Nhớ rồi
          </button>
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Hiện nghĩa
        </button>
      )}
    </div>
  );
}
