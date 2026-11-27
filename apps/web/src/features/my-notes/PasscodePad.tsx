'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/shared/ui/icons';
import { cx } from '@/shared/ui/primitives';

const LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * Phone-style passcode entry: six dots + a numeric keypad (also works with the keyboard).
 * `onComplete` gets the 6 digits; return `false` (or throw) to shake and clear.
 */
export function PasscodePad({
  title,
  subtitle,
  error,
  onComplete,
  footer,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  onComplete: (code: string) => Promise<boolean | void> | boolean | void;
  footer?: React.ReactNode;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    async (full: string) => {
      setBusy(true);
      let ok: boolean | void = true;
      try {
        ok = await onComplete(full);
      } catch {
        ok = false;
      }
      setBusy(false);
      if (ok === false) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      setCode('');
    },
    [onComplete],
  );

  const press = useCallback(
    (k: string) => {
      if (busy) return;
      if (k === 'del') return setCode(code.slice(0, -1));
      if (code.length >= LENGTH) return;
      const next = code + k;
      setCode(next);
      if (next.length === LENGTH) void submit(next);
    },
    [busy, code, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center py-6 text-center sm:py-10">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon name="lock" className="h-6 w-6" />
      </span>
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>}

      <div className={cx('my-7 flex gap-3.5', shake && 'animate-shake')} aria-label={`${code.length} of ${LENGTH} digits entered`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={i}
            className={cx(
              'h-3.5 w-3.5 rounded-full border-2 transition-colors',
              i < code.length ? 'border-accent bg-accent' : 'border-line-strong',
              error && code.length === 0 && 'border-danger',
            )}
          />
        ))}
      </div>
      <p className="-mt-3 mb-4 h-5 text-[13px] text-danger-text">{error}</p>

      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k}
              className={cx(
                'flex h-16 items-center justify-center rounded-full text-2xl font-medium tabular-nums transition active:scale-95 disabled:opacity-50',
                k === 'del' ? 'text-fg-muted hover:bg-muted' : 'bg-surface text-fg shadow-xs ring-1 ring-line hover:bg-subtle',
              )}
            >
              {k === 'del' ? <Icon name="backspace" className="h-6 w-6" /> : k}
            </button>
          ),
        )}
      </div>
      {footer && <div className="mt-6 text-[13px] text-fg-muted">{footer}</div>}
    </div>
  );
}
