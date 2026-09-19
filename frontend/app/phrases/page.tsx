'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, Phrase, PhraseInput } from '../lib/api';

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
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phrases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cụm từ tiếng Anh — mỗi ngày 08:00 (giờ VN) gửi 3 cụm vào Telegram,
            xoay vòng theo số lần đã gửi. Tắt công tắc “Gửi TG” để ngừng gửi một
            cụm.
          </p>
          {!loading && phrases.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {phrases.filter((p) => p.active).length}/{phrases.length} cụm đang
              gửi
            </p>
          )}
        </div>
        <button
          onClick={onSendNow}
          disabled={sending}
          className="shrink-0 rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {sending ? 'Đang gửi…' : 'Gửi ngay'}
        </button>
      </div>

      {/* Add / edit form */}
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
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
            <label className="mb-1 block text-sm font-medium text-slate-700">
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
          <label className="mb-1 block text-sm font-medium text-slate-700">
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
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : '+ Thêm cụm từ'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Huỷ
            </button>
          )}
        </div>
      </form>

      {notice && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : phrases.length === 0 ? (
        <p className="text-sm text-slate-500">
          Chưa có cụm từ nào. Thêm cụm đầu tiên ở trên.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
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
                  className={`border-b last:border-0 hover:bg-slate-50 ${
                    p.active ? '' : 'bg-slate-50/60 text-slate-400'
                  }`}
                >
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      p.active ? 'text-slate-800' : 'text-slate-400 line-through'
                    }`}
                  >
                    {p.phrase}
                  </td>
                  <td className={`px-3 py-2 ${p.active ? 'text-slate-600' : 'text-slate-400'}`}>
                    {p.meaning}
                  </td>
                  <td className={`px-3 py-2 italic ${p.active ? 'text-slate-500' : 'text-slate-400'}`}>
                    {p.example || '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onToggleActive(p)}
                      title={p.active ? 'Đang gửi — bấm để tắt' : 'Đã tắt — bấm để bật lại'}
                      className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
                        p.active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          p.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {p.sentCount}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-indigo-600 hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="ml-3 text-red-600 hover:underline"
                    >
                      Xoá
                    </button>
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
