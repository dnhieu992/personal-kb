'use client';

import { ClipboardEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteEntry } from '../../lib/api';
import { Icon, IconName } from '../icons';
import { Alert, cx, EmptyState, Loading } from '../ui';
import { api } from '../../lib/api';
import { NoteMarkdown, plainText, wordCount } from './markdown';

/** The CRUD a notebook needs; diary and tech notes each have their own backend table. */
export interface NoteStore {
  list: () => Promise<NoteEntry[]>;
  create: (content: string) => Promise<NoteEntry>;
  update: (id: string, content: string) => Promise<NoteEntry>;
  remove: (id: string) => Promise<unknown>;
}

export interface NotebookProps {
  title: string;
  description: string;
  store: NoteStore;
  /** localStorage key for the unsaved draft. */
  draftKey: string;
  placeholder: string;
  /** What one entry is called in messages, e.g. "ghi chép". */
  noun: string;
}

const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const full = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  if (d.toDateString() === today.toDateString()) return `Hôm nay · ${full}`;
  if (d.toDateString() === yesterday.toDateString()) return `Hôm qua · ${full}`;
  return full.charAt(0).toUpperCase() + full.slice(1);
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeDraft(key: string, text: string) {
  try {
    if (text) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch {
    /* private mode: the draft just isn't kept */
  }
}

/**
 * A Markdown notebook page: split editor | live preview filling the height,
 * toolbar, image upload/paste, and a History dialog of saved entries (by day,
 * search, edit, delete). Used by /diary and /tech-notes.
 */
export default function Notebook({ title, description, store, draftKey, placeholder, noun }: NotebookProps) {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  /** The saved entry being edited in the editor; null = writing a new one. */
  const [editing, setEditing] = useState<NoteEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await store.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    load();
    setText(readDraft(draftKey));
  }, [load, draftKey]);

  // Only a new entry's draft survives a reload; edits of saved ones don't.
  useEffect(() => {
    if (!editing) writeDraft(draftKey, text);
  }, [text, editing, draftKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const entry = await store.update(editing.id, text);
        setEntries((list) => list.map((x) => (x.id === entry.id ? entry : x)));
        setNotice(`Đã cập nhật ${noun} lúc ${stamp(entry.createdAt)}`);
        setEditing(null);
        setText(readDraft(draftKey));
      } else {
        const entry = await store.create(text);
        setEntries((list) => [entry, ...list]);
        setNotice(`Đã lưu lúc ${stamp(entry.createdAt)} — xem lại trong History`);
        setText('');
      }
      area.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: NoteEntry) {
    setEditing(entry);
    setText(entry.content);
    setHistoryOpen(false);
    setTimeout(() => area.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(null);
    setText(readDraft(draftKey));
  }

  async function remove(entry: NoteEntry) {
    if (!confirm(`Xoá ${noun} lúc ${stamp(entry.createdAt)}? Không khôi phục được.`)) return;
    setError(null);
    try {
      await store.remove(entry.id);
      setEntries((list) => list.filter((x) => x.id !== entry.id));
      if (editing?.id === entry.id) cancelEdit();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Replace the selection with what `fn` makes of it, then select [from, to) of the inserted text. */
  function edit(fn: (selected: string) => { text: string; from?: number; to?: number }) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const out = fn(text.slice(a, b));
    setText(text.slice(0, a) + out.text + text.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + (out.from ?? out.text.length), a + (out.to ?? out.text.length));
    });
  }
  const wrap = (before: string, after = before, fallback = 'chữ') =>
    edit((sel) => {
      const inner = sel || fallback;
      return { text: before + inner + after, from: before.length, to: before.length + inner.length };
    });
  /** Prefix every selected line (or the current one). */
  function linePrefix(prefix: (i: number) => string) {
    const el = area.current;
    if (!el) return;
    const start = text.lastIndexOf('\n', el.selectionStart - 1) + 1;
    let end = text.indexOf('\n', el.selectionEnd);
    if (end === -1) end = text.length;
    const block = text
      .slice(start, end)
      .split('\n')
      .map((line, i) => prefix(i) + line)
      .join('\n');
    setText(text.slice(0, start) + block + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + block.length, start + block.length);
    });
  }

  async function insertImages(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await api.uploadImages(images);
      edit(() => ({ text: uploaded.map((img) => `![${img.name ?? 'ảnh'}](${img.url})`).join('\n') + '\n' }));
    } catch (e) {
      setError(`Tải ảnh lỗi: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void insertImages(files);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrap('**');
    } else if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrap('*');
    } else if (e.key === 'Escape' && editing) {
      cancelEdit();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      edit(() => ({ text: '  ' }));
    }
  }

  /** Keep the preview at the same relative position as the editor. */
  function syncScroll() {
    const a = area.current;
    const p = preview.current;
    if (!a || !p) return;
    const ratio = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight);
  }

  function code() {
    const el = area.current;
    const multiline = !!el && text.slice(el.selectionStart, el.selectionEnd).includes('\n');
    if (multiline) wrap('```\n', '\n```');
    else wrap('`', '`', 'code');
  }

  type Tool = { icon: IconName; title: string; run: () => void; text?: string };
  const tools: Tool[][] = [
    [
      { icon: 'bold', title: 'Đậm (⌘B)', run: () => wrap('**') },
      { icon: 'italic', title: 'Nghiêng (⌘I)', run: () => wrap('*') },
      { icon: 'strike', title: 'Gạch ngang', run: () => wrap('~~') },
    ],
    [
      { icon: 'heading', text: '2', title: 'Tiêu đề', run: () => linePrefix(() => '## ') },
      { icon: 'heading', text: '3', title: 'Tiêu đề nhỏ', run: () => linePrefix(() => '### ') },
    ],
    [
      { icon: 'list', title: 'Danh sách', run: () => linePrefix(() => '- ') },
      { icon: 'list-ordered', title: 'Danh sách số', run: () => linePrefix((i) => `${i + 1}. `) },
      { icon: 'check', title: 'Checklist', run: () => linePrefix(() => '- [ ] ') },
      { icon: 'quote-block', title: 'Trích dẫn', run: () => linePrefix(() => '> ') },
      { icon: 'code', title: 'Code', run: code },
      { icon: 'divider', title: 'Đường kẻ ngang', run: () => edit(() => ({ text: '\n---\n' })) },
    ],
    [
      {
        icon: 'link',
        title: 'Link',
        run: () =>
          edit((sel) => {
            const label = sel || 'chữ';
            return { text: `[${label}](https://)`, from: label.length + 3, to: label.length + 11 };
          }),
      },
      { icon: 'image', title: 'Chèn ảnh (hoặc dán ảnh vào ô viết)', run: () => fileRef.current?.click() },
    ],
  ];

  return (
    <div className="flex flex-col gap-4 md:h-[calc(100dvh-3rem)]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-8 text-fg">{title}</h1>
          <p className="mt-0.5 text-sm text-fg-muted">{description}</p>
        </div>
        <button onClick={() => setHistoryOpen(true)} className="btn btn-secondary">
          <Icon name="clock" /> History
          {entries.length > 0 && <span className="chip tone-gray ml-0.5">{entries.length}</span>}
        </button>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="card flex min-h-[80vh] flex-1 flex-col overflow-hidden md:min-h-0">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-subtle px-2 py-1.5">
          {tools.map((group, gi) => (
            <div key={gi} className={cx('flex items-center gap-0.5', gi > 0 && 'ml-1 border-l border-line pl-1.5')}>
              {group.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  title={t.title}
                  aria-label={t.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={t.run}
                  className="flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-fg-secondary transition hover:bg-muted hover:text-fg"
                >
                  <Icon name={t.icon} className="h-4 w-4" strokeWidth={2} />
                  {t.text && <span className="-ml-0.5 mt-1.5 text-[10px] font-semibold">{t.text}</span>}
                </button>
              ))}
            </div>
          ))}
          {editing && (
            <span className="chip tone-amber ml-auto">
              <Icon name="pen" className="h-3 w-3" /> Đang sửa {noun} {stamp(editing.createdAt)}
            </span>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
          <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
            <p className="eyebrow border-b border-line px-4 py-2">Markdown</p>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onScroll={syncScroll}
              placeholder={placeholder}
              className="scrollbar-thin min-h-0 w-full flex-1 resize-none bg-surface px-4 py-3 font-mono text-[14px] leading-7 text-fg outline-none placeholder:text-fg-faint"
              autoFocus
              spellCheck={false}
            />
          </div>
          <div className="flex min-h-0 flex-col bg-subtle/40">
            <p className="eyebrow border-b border-line px-4 py-2">Preview</p>
            <div ref={preview} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {text.trim() ? (
                <NoteMarkdown content={text} />
              ) : (
                <p className="text-sm text-fg-subtle">Kết quả hiển thị ở đây khi bạn gõ.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-subtle/60 px-3 py-2">
          <span className="text-xs text-fg-subtle">
            {uploading ? (
              'Đang tải ảnh…'
            ) : notice ? (
              <span className="text-success-text">{notice}</span>
            ) : (
              `${wordCount(text)} từ · ⌘/Ctrl + Enter để lưu`
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {editing && (
              <button onClick={cancelEdit} className="btn btn-ghost btn-sm">
                Huỷ sửa
              </button>
            )}
            <button onClick={save} disabled={saving || !text.trim()} className="btn btn-primary btn-sm">
              <Icon name={editing ? 'check' : 'send'} /> {saving ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void insertImages(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      {historyOpen && (
        <HistoryDialog
          entries={entries}
          loading={loading}
          noun={noun}
          editingId={editing?.id ?? null}
          onClose={() => setHistoryOpen(false)}
          onEdit={startEdit}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function HistoryDialog({
  entries,
  loading,
  noun,
  editingId,
  onClose,
  onEdit,
  onDelete,
}: {
  entries: NoteEntry[];
  loading: boolean;
  noun: string;
  editingId: string | null;
  onClose: () => void;
  onEdit: (e: NoteEntry) => void;
  onDelete: (e: NoteEntry) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? entries.filter((e) => plainText(e.content).toLowerCase().includes(q)) : entries;
    const groups: { key: string; label: string; items: NoteEntry[] }[] = [];
    for (const e of shown) {
      const key = dayKey(e.createdAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(e);
      else groups.push({ key, label: dayLabel(e.createdAt), items: [e] });
    }
    return groups;
  }, [entries, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-3 md:p-8"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="History"
        className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Icon name="clock" className="h-4 w-4 text-fg-muted" />
          <h2 className="text-base font-semibold text-fg">History</h2>
          <span className="text-sm text-fg-muted">{entries.length} {noun}</span>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm ml-auto" aria-label="Đóng">
            <Icon name="x" />
          </button>
        </div>
        <div className="border-b border-line px-5 py-3">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm…"
              className="input w-full pl-9"
            />
          </div>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto bg-subtle/40 px-5 py-4">
          {loading ? (
            <Loading />
          ) : entries.length === 0 ? (
            <EmptyState icon="note" title={`Chưa có ${noun} nào`} description="Viết và lưu ở trang chính, chúng sẽ hiện ở đây." />
          ) : days.length === 0 ? (
            <p className="text-sm text-fg-muted">Không có {noun} nào khớp “{query}”.</p>
          ) : (
            days.map((day) => (
              <section key={day.key} className="space-y-2">
                <h3 className="eyebrow">{day.label}</h3>
                {day.items.map((e) => {
                  const edited = new Date(e.updatedAt).getTime() - new Date(e.createdAt).getTime() > 60_000;
                  return (
                    <article key={e.id} className={cx('card p-4', editingId === e.id && 'border-accent/50')}>
                      <div className="mb-2 flex items-center gap-2 text-xs text-fg-subtle">
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        <span title={stamp(e.createdAt)}>{time(e.createdAt)}</span>
                        {edited && <span title={`Sửa lúc ${stamp(e.updatedAt)}`}>· đã sửa</span>}
                        <span className="ml-auto flex gap-1">
                          <button onClick={() => onEdit(e)} className="btn btn-ghost btn-xs">
                            <Icon name="pen" className="h-3.5 w-3.5" /> Sửa
                          </button>
                          <button onClick={() => onDelete(e)} className="btn btn-ghost btn-xs text-danger-text">
                            <Icon name="trash" className="h-3.5 w-3.5" /> Xoá
                          </button>
                        </span>
                      </div>
                      <NoteMarkdown content={e.content} />
                    </article>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
