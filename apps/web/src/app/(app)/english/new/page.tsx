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
} from '@/features/english/api';
import { PageHeader } from '@/shared/ui/kit';
import ImageUploader from '@/features/english/ImageUploader';

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
      <div className="w-full space-y-6">
        <PageHeader title="Đã ghi vào nhật ký" back={{ href: '/english/journal', label: 'Journal' }} />
        <div className="card p-4">
          <p className="eyebrow">
            Tóm tắt
          </p>
          <p className="mt-1 text-fg-secondary">{result.journal.summary}</p>
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
          <h2 className="section-title mb-3">
            AI rút ra {result.items.length} mục để ôn
          </h2>
          {result.items.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Không có mục nào cần ôn lần này.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.items.map((it) => (
                <li key={it.id} className="card p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`chip ${
                        KIND_COLORS[it.englishKind as EnglishKind]
                      }`}
                    >
                      {KIND_LABELS[it.englishKind as EnglishKind]}
                    </span>
                    {it.cefrLevel && (
                      <span className="text-xs text-fg-subtle">
                        {it.cefrLevel}
                      </span>
                    )}
                    {it.hard && (
                      <span className="chip tone-amber">
                        khó nhớ
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{it.content}</p>
                  <p className="text-sm text-fg-muted">{it.summary}</p>
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
            className="btn btn-primary"
          >
            Ghi thêm
          </button>
          <Link
            href="/english/journal"
            className="btn btn-secondary"
          >
            Về nhật ký
          </Link>
          {result.items.length > 0 && (
            <Link
              href="/english/review"
              className="btn btn-secondary"
            >
              Ôn ngay
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        back={{ href: '/english/journal', label: 'Journal' }}
        title="Ghi nhật ký"
        description="Viết tự do về buổi học hôm nay (tiếng Việt cũng được). AI sẽ tóm tắt và rút ra câu, ngữ pháp, lỗi và từ vựng đáng nhớ để ôn lại."
      />

      <form onSubmit={onSubmit} className="card space-y-5 p-5">
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
          className="input w-full text-[15px] leading-relaxed"
        />

        <ImageUploader
          value={images}
          onChange={setImages}
          label="Ảnh đính kèm (không bắt buộc)"
        />

        {error && <p className="text-sm text-danger-text">{error}</p>}

        <div className="flex flex-row-reverse justify-start gap-2 border-t border-line pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'AI đang xử lý…' : 'Lưu nhật ký'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
          >
            Huỷ
          </button>
        </div>
      </form>
    </div>
  );
}
