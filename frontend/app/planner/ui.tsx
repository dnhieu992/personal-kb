'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import {
  AREA_ICON,
  AREA_LABEL,
  AREAS,
  Area,
  CATEGORY_PALETTE,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
} from '../lib/planner';
import { usePlanner } from './state';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function CheckBox({
  done,
  color,
  onToggle,
  size = 18,
}: {
  done: boolean;
  color: string;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className="flex shrink-0 items-center justify-center rounded-full border-2 transition hover:scale-110"
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: done ? color : 'transparent',
      }}
    >
      {done && (
        <svg viewBox="0 0 16 16" width={size - 6} height={size - 6} fill="none" stroke="white" strokeWidth="2.5">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      )}
    </button>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-emphasis" style={{ height }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }}
      />
    </div>
  );
}

export function PriorityFlag({ p }: { p: number }) {
  if (!p) return null;
  return (
    <span title={`Priority: ${PRIORITY_LABEL[p]}`} style={{ color: PRIORITY_COLOR[p] }} className="text-xs">
      ⚑
    </span>
  );
}

export function AreaBadge(_: { area: Area; className?: string }) {
  // Personal-only planner: no area label to show.
  return null;
}

export function EmptyState({ icon, text, children }: { icon: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-fg-subtle">
      <div className="text-3xl">{icon}</div>
      <div className="text-sm">{text}</div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number | boolean>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex rounded-lg bg-emphasis/70 p-0.5 text-sm', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition',
            o.value === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-secondary hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AreaPicker({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={AREAS.map((a) => ({ value: a, label: `${AREA_ICON[a]} ${AREA_LABEL[a]}` }))}
    />
  );
}

/** Category <select> for an area; "New category…" opens the editor and selects the result. */
export function CategoryPicker({
  area,
  value,
  onChange,
  noneLabel = 'No category',
  className,
}: {
  area: Area;
  value: number | null;
  onChange: (id: number | null) => void;
  noneLabel?: string;
  className?: string;
}) {
  const { categoriesIn, editCategory } = usePlanner();
  return (
    <select
      className={cx('input input-sm', className)}
      value={value ?? 0}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (v === -1) editCategory({ area, then: (id) => onChange(id) });
        else onChange(v || null);
      }}
    >
      <option value={0}>{noneLabel}</option>
      {categoriesIn(area).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={-1}>New category…</option>
    </select>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24" onMouseDown={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <h3 className="mb-4 text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function CategoryEditor() {
  const { categoryEditor: ed, closeCategoryEditor, run, go, meta } = usePlanner();
  const [name, setName] = useState('');
  const [area, setArea] = useState<Area>('PERSONAL');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]);

  useEffect(() => {
    if (!ed) return;
    setName(ed.edit?.name ?? '');
    setArea('PERSONAL');
    setColor(ed.edit?.color ?? CATEGORY_PALETTE[(meta?.categories.length ?? 0) % CATEGORY_PALETTE.length]);
  }, [ed, meta?.categories.length]);

  if (!ed) return null;
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    if (ed.edit) {
      await run(api.planner.updateCategory(ed.edit.id, { name: n, color, area }));
    } else {
      const c = await run(api.planner.addCategory({ name: n, color, area }));
      if (c) {
        if (ed.then) ed.then(c.id);
        else go({ kind: 'category', id: c.id });
      }
    }
    closeCategoryEditor();
  };
  return (
    <Modal title={ed.edit ? 'Edit category' : 'New category'} onClose={closeCategoryEditor}>
      <div className="space-y-4">
        <input
          autoFocus
          className="w-full input"
          placeholder="Name (e.g. Trading, Health, Reading)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 text-sm text-fg-secondary hover:bg-muted" onClick={closeCategoryEditor}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm disabled:opacity-40"
            disabled={!name.trim()}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Click to edit inline; Enter saves, Escape cancels. */
export function EditableTitle({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  startEditing = false,
  doubleClick = false,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  startEditing?: boolean;
  /** Enter edit mode on double-click (single clicks pass through to the parent). */
  doubleClick?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editing) {
    return (
      <span
        className={cx('cursor-text', !value && 'text-fg-subtle', className)}
        onClick={(e) => {
          if (doubleClick) return;
          e.stopPropagation();
          setEditing(true);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        title={doubleClick ? 'Double-click to rename' : 'Click to edit'}
      >
        {value || placeholder}
      </span>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      autoFocus
      className={cx('w-full rounded border border-accent/40 px-1.5 py-0.5 outline-none', inputClassName)}
      value={draft}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

/**
 * Markdown notes field: write / preview tabs, saves on blur (and after a pause
 * while typing). The Mac app's rich-text editor, in Markdown.
 */
export function MarkdownField({
  value,
  onSave,
  placeholder = 'Write in Markdown…',
  minRows = 6,
  onBlurSaved,
  extra,
}: {
  value: string;
  onSave: (v: string) => Promise<unknown> | void;
  placeholder?: string;
  minRows?: number;
  /** Called after the user leaves the editor with a changed text (e.g. to run an English check). */
  onBlurSaved?: (v: string) => void;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState(false);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dirtySinceFocus = useRef(false);

  useEffect(() => {
    // Accept outside changes (e.g. an English correction) unless we have unsaved edits.
    if (draft === saved.current) setDraft(value);
    saved.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const flush = (v: string) => {
    clearTimeout(timer.current);
    if (v === saved.current) return;
    saved.current = v;
    return onSave(v);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="card">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1 text-xs">
        <button
          type="button"
          className={cx('rounded px-2 py-0.5', !preview ? 'bg-muted font-medium' : 'text-fg-muted')}
          onClick={() => setPreview(false)}
        >
          Write
        </button>
        <button
          type="button"
          className={cx('rounded px-2 py-0.5', preview ? 'bg-muted font-medium' : 'text-fg-muted')}
          onClick={() => {
            flush(draft);
            setPreview(true);
          }}
        >
          Preview
        </button>
        <div className="ml-auto flex items-center gap-1">{extra}</div>
      </div>
      {preview ? (
        <div className="prose-kb min-h-[6rem] px-3 py-2 text-sm" onDoubleClick={() => setPreview(false)}>
          {draft.trim() ? <ReactMarkdown>{draft}</ReactMarkdown> : <span className="text-fg-subtle">Nothing yet</span>}
        </div>
      ) : (
        <textarea
          className="block w-full resize-y rounded-b-lg px-3 py-2 text-sm outline-none"
          rows={minRows}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            dirtySinceFocus.current = true;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => flush(v), 1200);
          }}
          onBlur={async () => {
            await flush(draft);
            if (dirtySinceFocus.current && onBlurSaved) onBlurSaved(draft);
            dirtySinceFocus.current = false;
          }}
        />
      )}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  return (
    <>
      {tags.map((t) => (
        <span key={t} className="text-accent-text">
          #{t}
        </span>
      ))}
    </>
  );
}

export function Spinner({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent/40 border-t-transparent align-middle"
    />
  );
}
