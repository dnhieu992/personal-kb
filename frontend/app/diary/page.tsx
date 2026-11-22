'use client';

import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, DiaryEntry } from '../lib/api';
import { Icon } from '../components/icons';
import { Alert, EmptyState, Loading, PageHeader } from '../components/ui';

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const full = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  if (same(d, today)) return `Hôm nay · ${full}`;
  if (same(d, yesterday)) return `Hôm qua · ${full}`;
  return full.charAt(0).toUpperCase() + full.slice(1);
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** ⌘/Ctrl + Enter saves. */
const isSave = (e: KeyboardEvent) => e.key === 'Enter' && (e.metaKey || e.ctrlKey);

export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await api.diary.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await api.diary.create(draft);
      setEntries((list) => [entry, ...list]);
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editing.text.trim()) return;
    setError(null);
    try {
      const entry = await api.diary.update(editing.id, editing.text);
      setEntries((list) => list.map((x) => (x.id === entry.id ? entry : x)));
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Xoá ghi chép này? Không khôi phục được.')) return;
    setError(null);
    try {
      await api.diary.remove(id);
      setEntries((list) => list.filter((x) => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? entries.filter((e) => e.content.toLowerCase().includes(q)) : entries;
    const groups: { key: string; label: string; items: DiaryEntry[] }[] = [];
    for (const e of shown) {
      const key = dayKey(e.createdAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(e);
      else groups.push({ key, label: dayLabel(e.createdAt), items: [e] });
    }
    return groups;
  }, [entries, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diary"
        description={
          <>
            Nhật ký hằng ngày — mỗi ghi chép lưu nội dung và thời điểm viết.
            {entries.length > 0 && <span className="ml-1 text-fg-subtle">{entries.length} ghi chép</span>}
          </>
        }
      />

      <div className="card space-y-3 p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => isSave(e) && add()}
          rows={5}
          placeholder="Hôm nay thế nào?"
          className="input w-full min-h-[120px] resize-y leading-relaxed"
          autoFocus
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">⌘/Ctrl + Enter để lưu</span>
          <button onClick={add} disabled={saving || !draft.trim()} className="btn btn-primary">
            <Icon name="plus" /> {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {entries.length > 0 && (
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong nhật ký…"
            className="input w-full pl-9"
          />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : entries.length === 0 ? (
        <EmptyState icon="note" title="Chưa có ghi chép nào" description="Viết dòng đầu tiên ở ô phía trên." />
      ) : days.length === 0 ? (
        <p className="text-sm text-fg-muted">Không có ghi chép nào khớp “{query}”.</p>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.key} className="space-y-2">
              <h2 className="eyebrow">{day.label}</h2>
              {day.items.map((e) => {
                const isEditing = editing?.id === e.id;
                const edited = new Date(e.updatedAt).getTime() - new Date(e.createdAt).getTime() > 60_000;
                return (
                  <article key={e.id} className="card group p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-fg-subtle">
                      <Icon name="clock" className="h-3.5 w-3.5" />
                      <span title={stamp(e.createdAt)}>{time(e.createdAt)}</span>
                      {edited && <span title={`Sửa lúc ${stamp(e.updatedAt)}`}>· đã sửa</span>}
                      {!isEditing && (
                        <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => setEditing({ id: e.id, text: e.content })}
                            className="btn btn-ghost btn-xs"
                          >
                            <Icon name="pen" className="h-3.5 w-3.5" /> Sửa
                          </button>
                          <button onClick={() => remove(e.id)} className="btn btn-ghost btn-xs text-danger-text">
                            <Icon name="trash" className="h-3.5 w-3.5" /> Xoá
                          </button>
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editing.text}
                          onChange={(ev) => setEditing({ id: e.id, text: ev.target.value })}
                          onKeyDown={(ev) => {
                            if (isSave(ev)) saveEdit();
                            if (ev.key === 'Escape') setEditing(null);
                          }}
                          rows={Math.min(16, Math.max(4, editing.text.split('\n').length + 1))}
                          className="input w-full resize-y leading-relaxed"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={!editing.text.trim()} className="btn btn-primary btn-sm">
                            Lưu
                          </button>
                          <button onClick={() => setEditing(null)} className="btn btn-secondary btn-sm">
                            Huỷ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">{e.content}</p>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
