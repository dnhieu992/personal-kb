'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { PageHeader } from '../components/ui';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: { id: string; title: string; score: number }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.chat(question);
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.answer, sources: res.sources },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  const suggestions = [
    'How did we fix the slow orders endpoint?',
    'What do I know about caching strategies?',
    'Summarize my notes on deployment',
  ];

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="Ask AI" description="Ask in plain language — Claude searches your entries and answers with sources." />

      <div className="flex-1 space-y-5 pb-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
              <Icon name="sparkles" className="h-6 w-6" />
            </span>
            <p className="font-medium text-fg">What would you like to know?</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((q) => (
                <button key={q} onClick={() => setInput(q)} className="btn btn-secondary btn-sm font-normal text-fg-secondary">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-fg">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                <Icon name="sparkles" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="prose-kb">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.sources.map((s, n) => (
                      <Link
                        key={s.id}
                        href={`/knowledge/${s.id}/edit`}
                        className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-secondary transition hover:border-line-strong hover:text-fg"
                        title={`Similarity ${s.score}`}
                      >
                        <span className="font-semibold text-fg-subtle">{n + 1}</span>
                        <span className="truncate">{s.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-center gap-3 text-[13px] text-fg-muted">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
              <Icon name="sparkles" className="h-4 w-4 animate-pulse" />
            </span>
            Searching your knowledge…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 -mx-1 bg-gradient-to-t from-canvas via-canvas to-transparent px-1 pb-4 pt-6">
        <div className="card flex items-center gap-2 p-1.5 pl-4 shadow-md focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your knowledge base…"
            className="h-9 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary btn-icon" aria-label="Send">
            <Icon name="send" />
          </button>
        </div>
      </form>
    </div>
  );
}
