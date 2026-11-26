'use client';

import { PRIORITIES } from '@pkb/contracts';
import { forwardRef } from 'react';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md' };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'outline', size = 'md', className, ...p }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent-hover',
        variant === 'outline' && 'border border-line-strong bg-surface text-fg hover:bg-subtle',
        variant === 'ghost' && 'text-fg-secondary hover:bg-muted hover:text-fg',
        variant === 'danger' && 'text-red-600 hover:bg-red-50',
        className,
      )}
      {...p}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return (
    <input
      ref={ref}
      className={cx('h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20', className)}
      {...p}
    />
  );
});

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx('h-9 rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-accent', className)}
      {...p}
    />
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx('w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20', className)}
      {...p}
    />
  );
});

const PRIORITY_STYLE = ['bg-muted text-fg-secondary', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-800', 'bg-red-100 text-red-700'];
export function PriorityBadge({ value }: { value: number }) {
  return <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium', PRIORITY_STYLE[value])}>{PRIORITIES[value]}</span>;
}

export function ProjectDot({ color }: { color: string | null }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? '#a1a1aa' }} />;
}

export function Tag({ name, onClick, active }: { name: string; onClick?: () => void; active?: boolean }) {
  return (
    <span
      onClick={
        onClick &&
        ((e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        })
      }
      className={cx(
        'rounded-full px-2 py-0.5 text-xs',
        active ? 'bg-accent text-accent-fg' : 'bg-muted text-fg-secondary',
        onClick && 'cursor-pointer hover:bg-emphasis hover:text-fg',
      )}
    >
      #{name}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-fg-muted">{children}</div>;
}

export function Spinner() {
  return <div className="p-6 text-sm text-fg-subtle">Loading…</div>;
}

export function formatDue(due: string | null, today: string): { label: string; tone: string } | null {
  if (!due) return null;
  if (due < today) return { label: `overdue · ${due.slice(5)}`, tone: 'text-red-600' };
  if (due === today) return { label: 'today', tone: 'text-amber-700' };
  return { label: due.slice(5), tone: 'text-fg-muted' };
}
