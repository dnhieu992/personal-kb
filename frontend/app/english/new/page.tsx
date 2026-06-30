'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function NewEnglishPage() {
  const router = useRouter();
  const [sentence, setSentence] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = sentence.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      await api.create({
        // Title is required by the API; derive a short one from the sentence.
        title: text.length > 60 ? `${text.slice(0, 57)}…` : text,
        content: text,
        type: 'ENGLISH',
        tags: [],
      });
      router.push('/english');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add an English sentence</h1>
      <p className="text-sm text-slate-500">
        Type a sentence you want to remember. The meaning, CEFR level, and tags
        are filled in automatically.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Sentence</label>
          <textarea
            required
            autoFocus
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={4}
            placeholder="e.g. I should have left earlier to avoid the traffic."
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save sentence'}
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
    </div>
  );
}
