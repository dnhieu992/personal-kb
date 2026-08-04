'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  api,
  ImageRef,
  Knowledge,
  KNOWLEDGE_TYPES,
  KnowledgeType,
  Project,
} from '../lib/api';
import ImageUploader from './ImageUploader';

interface Props {
  initial?: Knowledge;
  defaultProjectId?: string;
}

export default function KnowledgeForm({ initial, defaultProjectId }: Props) {
  const router = useRouter();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [type, setType] = useState<KnowledgeType>(initial?.type ?? 'INSIGHT');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState<ImageRef[]>(initial?.images ?? []);
  const [preview, setPreview] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>(
    initial?.projectId ?? defaultProjectId ?? '',
  );

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {
      /* non-fatal — selector just stays empty */
    });
  }, []);

  const [formatting, setFormatting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On save the backend runs the content through the AI to reformat it as
  // structured Markdown. ENGLISH journals are always kept verbatim.
  const [autoFormat, setAutoFormat] = useState(true);
  const canFormat = type !== 'ENGLISH';

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  // Reformat the content right now so it can be reviewed before saving.
  async function formatNow() {
    if (!content.trim()) return;
    setFormatting(true);
    setError(null);
    try {
      const { content: formatted } = await api.formatContent(
        content,
        title,
        type,
      );
      setContent(formatted);
      setPreview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFormatting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        title,
        content,
        type,
        tags,
        projectId: projectId || null,
        images,
        autoFormat: canFormat && autoFormat,
      };
      const saved = editing
        ? await api.update(initial!.id, body)
        : await api.create(body);
      router.push(`/knowledge`);
      router.refresh();
      return saved;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as KnowledgeType)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {KNOWLEDGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">Content (Markdown)</label>
          <div className="flex items-center gap-3">
            {canFormat && (
              <button
                type="button"
                onClick={formatNow}
                disabled={formatting || !content.trim()}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                {formatting ? 'Đang format…' : '✨ Format ngay với AI'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>
        {preview ? (
          <div className="prose-kb min-h-[12rem] rounded-md border border-slate-200 bg-white p-3">
            <ReactMarkdown>{content || '*Nothing to preview*'}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Write in Markdown…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-sm text-indigo-700"
            >
              #{t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="text-indigo-400 hover:text-indigo-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Type a tag and press Enter"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <ImageUploader
        value={images}
        onChange={setImages}
        label="Ảnh (không bắt buộc)"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canFormat && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoFormat}
            onChange={(e) => setAutoFormat(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            ✨ Để AI format lại nội dung khi lưu
            <span className="block text-xs text-slate-500">
              Nội dung được viết lại thành Markdown có cấu trúc (heading, list,
              code block) — giữ nguyên ý, chỉ đổi cách trình bày.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving
            ? canFormat && autoFormat
              ? 'Đang format & lưu…'
              : 'Saving…'
            : editing
              ? 'Update'
              : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-5 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
