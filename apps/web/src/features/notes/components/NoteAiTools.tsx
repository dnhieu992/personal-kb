'use client';

import { useState } from 'react';
import { Markdown } from '@/shared/markdown/Markdown';
import { errorMessage } from '@/shared/http';
import { Dialog } from '@/shared/ui/dialog';
import { Button, Spinner, Tag } from '@/shared/ui/primitives';
import { toast } from '@/shared/ui/toast';
import { notesApi } from '../api';

type Mode = 'tags' | 'summary' | 'rewrite';

/**
 * AI helpers for the note editor (on click only). Every result is a proposal shown in a
 * dialog: nothing changes in the draft until you accept, and nothing is saved until you save.
 */
export function NoteAiTools({
  title,
  content,
  tags,
  onAddTags,
  onReplaceContent,
}: {
  title: string;
  content: string;
  tags: string[];
  onAddTags: (tags: string[]) => void;
  onReplaceContent: (content: string) => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState('');
  const [rewrite, setRewrite] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(m: Mode) {
    setMode(m);
    setBusy(true);
    setError(null);
    try {
      const input = { title, content };
      if (m === 'tags') {
        const r = await notesApi.ai.suggestTags(input);
        const fresh = r.tags.filter((t) => !tags.includes(t));
        setSuggested(fresh);
        setPicked(new Set(fresh));
      } else if (m === 'summary') {
        setSummary((await notesApi.ai.summarize(input)).summary);
      } else {
        setRewrite((await notesApi.ai.rewrite(input)).content);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const close = () => setMode(null);
  const empty = !content.trim();

  return (
    <>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" type="button" disabled={empty} onClick={() => run('tags')} title="Suggest tags">✦ Tags</Button>
        <Button size="sm" variant="ghost" type="button" disabled={empty} onClick={() => run('summary')} title="Summarize">✦ Summary</Button>
        <Button size="sm" variant="ghost" type="button" disabled={empty} onClick={() => run('rewrite')} title="Rewrite concisely">✦ Rewrite</Button>
      </div>
      {mode && (
        <Dialog open onClose={close} wide={mode === 'rewrite'}>
          <div className="p-5">
          <h2 className="mb-4 text-base font-semibold">{mode === 'tags' ? 'Suggested tags' : mode === 'summary' ? 'Summary' : 'Concise rewrite'}</h2>
          {busy ? (
            <div className="flex items-center gap-2 py-6 text-sm text-fg-muted"><Spinner /> Asking the AI…</div>
          ) : error ? (
            <p className="py-4 text-sm text-danger-text">{error}</p>
          ) : mode === 'tags' ? (
            <div className="space-y-4">
              {suggested.length ? (
                <div className="flex flex-wrap gap-2">
                  {suggested.map((t) => (
                    <label key={t} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm ${picked.has(t) ? 'border-accent bg-accent-soft' : 'border-line opacity-60'}`}>
                      <input
                        type="checkbox"
                        className="accent-[rgb(var(--accent))]"
                        checked={picked.has(t)}
                        onChange={() => {
                          const n = new Set(picked);
                          n.has(t) ? n.delete(t) : n.add(t);
                          setPicked(n);
                        }}
                      />
                      #{t}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-fg-muted">No new tags to suggest — the current ones fit.</p>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">Already tagged: {tags.map((t) => <Tag key={t} name={t} />)}</div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button variant="primary" disabled={!picked.size} onClick={() => { onAddTags([...picked]); close(); }}>Add {picked.size || ''} tag{picked.size === 1 ? '' : 's'}</Button>
              </div>
            </div>
          ) : mode === 'summary' ? (
            <div className="space-y-4">
              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-line p-3"><Markdown>{summary}</Markdown></div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(summary); toast('Copied'); }}>Copy</Button>
                <Button variant="primary" onClick={() => { onReplaceContent(`> **Summary** — ${summary.replace(/\n/g, '\n> ')}\n\n${content}`); close(); }}>Insert at top</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Current · {content.length} chars</div>
                  <pre className="whitespace-pre-wrap rounded-md border border-line bg-subtle p-3 text-xs">{content}</pre>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Rewrite · {rewrite.length} chars</div>
                  <pre className="whitespace-pre-wrap rounded-md border border-accent/40 bg-accent-soft/30 p-3 text-xs">{rewrite}</pre>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>Keep mine</Button>
                <Button variant="primary" onClick={() => { onReplaceContent(rewrite); close(); }}>Replace body</Button>
              </div>
            </div>
          )}
          </div>
        </Dialog>
      )}
    </>
  );
}
