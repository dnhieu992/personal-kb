'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask a question in natural language. Claude searches your knowledge base
          and answers with citations.
        </p>
      </div>

      <div className="min-h-[24rem] space-y-4 rounded-lg border bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Try: “How did we fix the slow orders endpoint?”
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-left ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose-kb">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-xs">
                  <p className="mb-1 font-semibold text-slate-500">Sources</p>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {m.sources.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/knowledge/${s.id}/edit`}
                          className="text-indigo-600 hover:underline"
                        >
                          {s.title}
                        </Link>{' '}
                        <span className="text-slate-400">({s.score})</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <p className="text-sm text-slate-400">Claude is thinking…</p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your knowledge base…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
