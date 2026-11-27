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
        'btn',
        size === 'sm' && 'btn-sm',
        variant === 'primary' && 'btn-primary',
        variant === 'outline' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger-ghost',
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
      className={cx('input h-9 w-full py-0', className)}
      {...p}
    />
  );
});

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx('input h-9 py-0 pl-2.5 pr-8', className)}
      {...p}
    />
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx('input w-full', className)}
      {...p}
    />
  );
});

const PRIORITY_STYLE = ['bg-muted text-fg-secondary', 'bg-info-soft text-info-text', 'bg-warning-soft text-warning-text', 'bg-danger-soft text-danger-text'];
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
  if (due < today) return { label: `overdue · ${due.slice(5)}`, tone: 'text-danger-text' };
  if (due === today) return { label: 'today', tone: 'text-warning-text' };
  return { label: due.slice(5), tone: 'text-fg-muted' };
}
