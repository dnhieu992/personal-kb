'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from '@/shared/ui/toast';
import { cx } from '@/shared/ui/primitives';
import { CheckSource, EnglishCheckDialog } from './EnglishCheckDialog';

/**
 * "Check English" for any core text field (note body, task title/description, checklist).
 * The only coupling between core editors and the English module: text goes in over
 * POST /api/english/check, accepted fixes come back to the field and are filed as review
 * cards via POST /api/english/mistakes. Nothing is saved to the note/task until the
 * caller saves as usual.
 *
 * `shortcut` binds ⌘/Ctrl+Shift+E while mounted (use it on one field per screen).
 */
export function CheckEnglishButton({
  text,
  onApply,
  source,
  sourceUrl,
  shortcut,
  compact,
  className,
}: CheckSource & {
  text: string;
  onApply: (next: string) => void;
  shortcut?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [checking, setChecking] = useState<string | null>(null);
  const latest = useRef(text);
  latest.current = text;

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (latest.current.trim()) setChecking(latest.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <>
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => setChecking(text)}
        title={`Check English${shortcut ? ' (⌘/Ctrl+Shift+E)' : ''}`}
        className={cx(
          'inline-flex items-center gap-1 rounded-md border border-line bg-surface text-fg-secondary hover:bg-subtle disabled:opacity-40',
          compact ? 'h-7 px-1.5 text-xs' : 'h-7 px-2 text-xs',
          className,
        )}
      >
        <span aria-hidden>Aa✓</span>
        {!compact && <span>Check English</span>}
      </button>
      {checking !== null && (
        <EnglishCheckDialog
          text={checking}
          source={source}
          sourceUrl={sourceUrl}
          onClose={() => setChecking(null)}
          onApply={(next, summary) => {
            setChecking(null);
            onApply(next);
            toast(summary);
          }}
        />
      )}
    </>
  );
}
