'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { Icon } from './icons';

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

  // On save the backend runs the content through the AI: reformat as structured
  // Markdown, translate to English, and collect the grammar/vocabulary to
  // revise. Not optional — the knowledge base is English-only. ENGLISH journals
  // are the exception and stay verbatim.
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
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      {/* Writing area */}
      <div className="min-w-0 space-y-4">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-faint"
        />

        <div className="card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-line bg-subtle px-2 py-1.5">
            <div className="flex rounded-md bg-muted p-0.5">
              {(['Write', 'Preview'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreview(m === 'Preview')}
                  className={`rounded px-2.5 py-0.5 text-[13px] font-medium transition ${
                    (m === 'Preview') === preview ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <span className="ml-2 text-xs text-fg-subtle">Markdown</span>
            {canFormat && (
              <button
                type="button"
                onClick={formatNow}
                disabled={formatting || !content.trim()}
                className="btn btn-ghost btn-xs ml-auto"
              >
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                {formatting ? 'Đang dịch…' : 'Format & dịch ngay'}
              </button>
            )}
          </div>
          {preview ? (
            <div className="prose-kb min-h-[22rem] p-4">
              <ReactMarkdown>{content || '*Nothing to preview*'}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              placeholder="Write in Markdown — any language, it gets translated to English on save."
              className="block min-h-[22rem] w-full resize-y bg-surface p-4 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
            />
          )}
        </div>

        {initial?.originalContent && (
          <details className="card px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-medium text-fg-secondary">
              Bản gốc bạn đã viết (trước khi AI dịch)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-fg-muted">{initial.originalContent}</pre>
          </details>
        )}
      </div>

      {/* Details */}
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="card space-y-4 p-4">
          <div>
            <label className="label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as KnowledgeType)} className="input w-full">
              {KNOWLEDGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input w-full">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Tags</label>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="chip tone-accent">
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t}`}>
                      <Icon name="x" className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Add a tag, press Enter"
              className="input input-sm w-full"
            />
          </div>

          <ImageUploader value={images} onChange={setImages} label="Ảnh (không bắt buộc)" />
        </div>

        {canFormat && (
          <div className="rounded-xl border border-accent/20 bg-accent-soft p-3.5 text-[13px] text-accent-text">
            <p className="flex items-center gap-1.5 font-medium">
              <Icon name="sparkles" className="h-3.5 w-3.5" /> AI khi lưu
            </p>
            <p className="mt-1 opacity-90">
              Format lại thành Markdown có cấu trúc và dịch sang tiếng Anh. Lỗi ngữ pháp và từ mới được đưa vào{' '}
              <Link href="/english/review" className="underline">
                ôn tập English
              </Link>
              ; bản gốc vẫn được giữ.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-danger-text">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary flex-1">
            {saving ? (canFormat ? 'Đang dịch & lưu…' : 'Saving…') : editing ? 'Save changes' : 'Create entry'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </aside>
    </form>
  );
}
