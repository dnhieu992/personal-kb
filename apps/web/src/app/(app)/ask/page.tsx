'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { AskResult } from '@pkb/contracts';
import { useAsk } from '@/features/search/api';
import { errorMessage } from '@/shared/http';
import { Markdown } from '@/shared/markdown/Markdown';
import { Button, Spinner, Textarea } from '@/shared/ui/primitives';

interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
}

/** Ask your notes (RAG): answers come only from the passages shown as sources. */
function AskView() {
  const params = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = useAsk();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  function submit() {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const i = turns.length;
    setTurns((t) => [...t, { question }]);
    setText('');
    ask.mutate(question, {
      onSuccess: (result) => setTurns((t) => t.map((x, j) => (j === i ? { ...x, result } : x))),
      onError: (e) => setTurns((t) => t.map((x, j) => (j === i ? { ...x, error: errorMessage(e) } : x))),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Ask your notes</h1>
        <p className="text-sm text-fg-muted">Answers are written only from the most relevant passages of your notes and attachments, with numbered sources.</p>
      </div>

      <div className="space-y-6">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-soft px-3 py-2 text-sm">{t.question}</div>
            {t.error ? (
              <p className="text-sm text-danger-text">{t.error}</p>
            ) : !t.result ? (
              <div className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> Reading your notes…</div>
            ) : (
              <div className="rounded-lg border border-line bg-surface p-4">
                <Markdown>{t.result.answer}</Markdown>
                {t.result.sources.length > 0 && (
                  <ol className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                    {t.result.sources.map((s) => (
                      <li key={s.n} className="flex gap-2">
                        <span className="tabular-nums text-fg-subtle">[{s.n}]</span>
                        <Link href={`/notes/${s.noteId}`} className="link">{s.title}</Link>
                        {s.origin !== 'note' && <span className="text-fg-muted">📎 {s.origin}</span>}
                        <span className="ml-auto tabular-nums text-fg-subtle">{Math.round(s.score * 100)}%</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-4 flex items-end gap-2 rounded-lg border border-line bg-surface p-2 shadow-md"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          autoFocus
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. How did I fix the Kafka rebalance issue?  (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none border-0 focus:ring-0"
        />
        <Button variant="primary" type="submit" disabled={!text.trim() || ask.isPending}>Ask</Button>
      </form>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AskView />
    </Suspense>
  );
}
