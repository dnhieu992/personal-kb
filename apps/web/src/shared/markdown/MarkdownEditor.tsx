'use client';

import { forwardRef, useState } from 'react';
import { cx, Textarea } from '../ui/primitives';
import { Markdown } from './Markdown';

/**
 * Shared editor. Knows nothing about features: callers pass `toolbarExtras` (e.g. an
 * upload button now, "Check English" in Phase 2) and handle paste/drop via props.
 */
export const MarkdownEditor = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    minRows?: number;
    toolbarExtras?: React.ReactNode;
    onPasteFiles?: (files: File[]) => void;
  }
>(function MarkdownEditor({ value, onChange, placeholder, minRows = 10, toolbarExtras, onPasteFiles }, ref) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div className="rounded-md border border-line-strong">
      <div className="flex items-center gap-1 border-b border-line bg-subtle px-2 py-1">
        {(['write', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cx('rounded px-2 py-1 text-xs capitalize', tab === t ? 'bg-surface font-medium shadow-sm' : 'text-fg-muted hover:text-fg')}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">{toolbarExtras}</div>
      </div>
      {tab === 'write' ? (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Markdown…'}
          rows={minRows}
          className="rounded-none border-0 font-mono text-[13px] focus:ring-0"
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length && onPasteFiles) {
              e.preventDefault();
              onPasteFiles(files);
            }
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length && onPasteFiles) {
              e.preventDefault();
              onPasteFiles(files);
            }
          }}
        />
      ) : (
        <div className="min-h-[10rem] p-3">{value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-fg-subtle">Nothing to preview.</p>}</div>
      )}
    </div>
  );
});
