'use client';

import { useRef, useState } from 'react';
import { api, ImageRef } from '../lib/api';

interface Props {
  value: ImageRef[];
  onChange: (images: ImageRef[]) => void;
  label?: string;
}

/**
 * Reusable image picker + uploader. Uploads selected files to R2 (via the
 * backend) and reports the resulting image refs through onChange. Shows
 * thumbnails with a remove button. Drop this into any form.
 */
export default function ImageUploader({ value, onChange, label = 'Ảnh' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await api.uploadImages(files);
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(key: string) {
    onChange(value.filter((img) => img.key !== key));
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
        >
          {uploading ? 'Đang tải lên…' : '+ Thêm ảnh'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={onSelect}
        className="hidden"
      />

      {value.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((img) => (
            <div
              key={img.key}
              className="group relative aspect-square overflow-hidden rounded-md border bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name ?? ''}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(img.key)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                title="Xoá ảnh"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-300 py-6 text-sm text-slate-400 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Đang tải lên…' : 'Bấm để chọn ảnh (jpg, png, webp, gif)'}
        </button>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
