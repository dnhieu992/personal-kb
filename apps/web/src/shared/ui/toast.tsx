'use client';

import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; kind: 'info' | 'error' };
let listeners: ((t: Toast) => void)[] = [];
let seq = 0;

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++seq, text, kind };
  listeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 5000);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`max-w-sm rounded-md px-4 py-2 text-sm shadow-lg ${t.kind === 'error' ? 'bg-red-600 text-accent-fg' : 'bg-accent text-accent-fg'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
