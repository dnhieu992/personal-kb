'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, Phrase, PhraseInput } from '@/features/english/api';
import { Icon } from '@/shared/ui/icons';
import { Alert, EmptyState, Loading, PageHeader } from '@/shared/ui/kit';

const EMPTY: PhraseInput = { phrase: '', meaning: '', example: '' };

export default function PhrasesPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The top form doubles as create + edit: editingId === null means "create".
  const [form, setForm] = useState<PhraseInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPhrases(await api.phrases.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.phrase.trim() || !form.meaning.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body: PhraseInput = {
        phrase: form.phrase.trim(),
        meaning: form.meaning.trim(),
        example: form.example?.trim() || null,
      };
      if (editingId) {
        await api.phrases.update(editingId, body);
      } else {
        await api.phrases.create(body);
      }
      resetForm();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: Phrase) {
    setEditingId(p.id);
    setForm({ phrase: p.phrase, meaning: p.meaning, example: p.example ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onDelete(id: string) {
    if (!confirm('Xoá cụm từ này?')) return;
    setError(null);
    try {
      await api.phrases.remove(id);
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onToggleActive(p: Phrase) {
    setError(null);
    // Optimistic flip so the toggle feels instant.
    setPhrases((list) =>
      list.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)),
    );
    try {
      await api.phrases.setActive(p.id, !p.active);
    } catch (e) {
      setError((e as Error).message);
      await load(); // revert to server truth on failure
    }
  }

  async function onSendNow() {
    setSending(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api.phrases.sendNow();
      setNotice(
        res.sent > 0
          ? `Đã gửi ${res.sent} cụm từ vào Telegram.`
          : 'Không có cụm từ nào để gửi (hoặc Telegram chưa cấu hình).',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    'w-full input';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phrases"
        description={
          <>
            Cụm từ tiếng Anh — mỗi 8 giờ (00:00, 08:00, 16:00 giờ VN) gửi 5 cụm vào Telegram, xoay vòng theo số lần đã gửi.
            {!loading && phrases.length > 0 && (
              <span className="mt-1 block text-xs text-fg-subtle">
                {phrases.filter((p) => p.active).length}/{phrases.length} cụm đang gửi
              </span>
            )}
          </>
        }
        actions={
          <button onClick={onSendNow} disabled={sending} className="btn btn-secondary">
            <Icon name="send" /> {sending ? 'Đang gửi…' : 'Gửi ngay'}
          </button>
        }
      />

      {/* Add / edit form */}
      <form
        onSubmit={onSubmit}
        className="card space-y-4 p-5"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">
              Cụm từ *
            </label>
            <input
              value={form.phrase}
              onChange={(e) => setForm({ ...form, phrase: e.target.value })}
              placeholder="break the ice"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="label">
              Nghĩa *
            </label>
            <input
              value={form.meaning}
              onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              placeholder="phá vỡ sự ngại ngùng ban đầu"
              className={inputClass}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">
            Ví dụ
          </label>
          <input
            value={form.example ?? ''}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            placeholder="He told a joke to break the ice."
            className={inputClass}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Thêm cụm từ'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
            >
              Huỷ
            </button>
          )}
        </div>
      </form>

      {notice && (
        <Alert tone="success">{notice}</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {/* Table */}
      {loading ? (
        <Loading label="Đang tải…" />
      ) : phrases.length === 0 ? (
        <EmptyState icon="quote" title="Chưa có cụm từ nào" description="Thêm cụm đầu tiên ở trên." />
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-subtle text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="w-10 px-3 py-2">#</th>
                <th className="px-3 py-2">Cụm từ</th>
                <th className="px-3 py-2">Nghĩa</th>
                <th className="px-3 py-2">Ví dụ</th>
                <th className="w-24 px-3 py-2 text-center">Gửi TG</th>
                <th className="w-20 px-3 py-2 text-center">Đã gửi</th>
                <th className="w-28 px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {phrases.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-line last:border-0 hover:bg-subtle ${
                    p.active ? '' : 'text-fg-subtle'
                  }`}
                >
                  <td className="px-3 py-2 text-fg-subtle">{i + 1}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      p.active ? 'text-fg' : 'text-fg-subtle line-through'
                    }`}
                  >
                    {p.phrase}
                  </td>
                  <td className={`px-3 py-2 ${p.active ? 'text-fg-secondary' : 'text-fg-subtle'}`}>
                    {p.meaning}
                  </td>
                  <td className={`px-3 py-2 italic ${p.active ? 'text-fg-muted' : 'text-fg-subtle'}`}>
                    {p.example || '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onToggleActive(p)}
                      title={p.active ? 'Đang gửi — bấm để tắt' : 'Đã tắt — bấm để bật lại'}
                      className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                        p.active ? 'bg-success' : 'bg-emphasis'
                      }`}
                    >
                      <span
                        className={`h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          p.active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="chip tone-gray tabular-nums">
                      {p.sentCount}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-0.5">
                      <button onClick={() => startEdit(p)} className="btn btn-ghost btn-icon btn-xs" title="Sửa">
                        <Icon name="pen" className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onDelete(p.id)} className="btn btn-danger-ghost btn-icon btn-xs" title="Xoá">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
