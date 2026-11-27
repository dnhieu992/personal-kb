'use client';

import { cx } from '@/shared/ui/primitives';

/** Round avatar: the uploaded picture, else initials on the accent colour. */
export function Avatar({ name, url, size = 32, className }: { name: string; url: string | null; size?: number; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-accent-fg', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
