'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api,
  ImageRef,
  JournalWithItems,
  KIND_COLORS,
  KIND_LABELS,
  EnglishKind,
} from '../../lib/api';
import ImageUploader from '../../components/ImageUploader';

export default function NewJournalPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [images, setImages] = useState<ImageRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JournalWithItems | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.english.createJournal(body, images);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // After saving, show what the AI pulled out.
  if (result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Đã ghi vào nhật ký ✓</h1>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-400">
            Tóm tắt
          </p>
          <p className="mt-1 text-slate-700">{result.journal.summary}</p>
          {result.journal.images && result.journal.images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {result.journal.images.map((img) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={img.key}
                  src={img.url}
                  alt={img.name ?? ''}
                  className="aspect-square w-full rounded-md border object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">
            AI rút ra {result.items.length} mục để ôn
          </h2>
          {result.items.length === 0 ? (
            <p className="text-sm text-slate-500">
              Không có mục nào cần ôn lần này.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.items.map((it) => (
                <li key={it.id} className="rounded-lg border bg-white p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        KIND_COLORS[it.englishKind as EnglishKind]
                      }`}
                    >
                      {KIND_LABELS[it.englishKind as EnglishKind]}
                    </span>
                    {it.cefrLevel && (
                      <span className="text-xs text-slate-400">
                        {it.cefrLevel}
                      </span>
                    )}
                    {it.hard && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        khó nhớ
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{it.content}</p>
                  <p className="text-sm text-slate-500">{it.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setResult(null);
              setText('');
              setImages([]);
            }}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Ghi thêm
          </button>
          <Link
            href="/english"
            className="rounded-md border px-5 py-2 text-sm"
          >
            Về nhật ký
          </Link>
          {result.items.length > 0 && (
            <Link
              href="/english/review"
              className="rounded-md border border-indigo-600 px-5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Ôn ngay
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ghi nhật ký học tiếng Anh</h1>
      <p className="text-sm text-slate-500">
        Viết tự do về buổi học hôm nay (tiếng Việt cũng được). AI sẽ tóm tắt và
        tự rút ra các câu / ngữ pháp / lỗi / từ vựng đáng nhớ để bạn ôn lại.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <textarea
          required
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={
            'Ví dụ: Hôm nay học được mẫu câu "I should have left earlier", thấy khá khó nhớ. ' +
            'Câu "I\'m getting the hang of it" gặp lần thứ 3 rồi mà vẫn phải tra...'
          }
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />

        <ImageUploader
          value={images}
          onChange={setImages}
          label="Ảnh đính kèm (không bắt buộc)"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'AI đang xử lý…' : 'Lưu nhật ký'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border px-5 py-2 text-sm"
          >
            Huỷ
          </button>
        </div>
      </form>
    </div>
  );
}
