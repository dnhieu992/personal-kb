import Link from 'next/link';
import { Icon, IconName } from '@/shared/ui/icons';

/**
 * Shared layout primitives. Server-safe (no hooks), so both RSC pages and client
 * pages can use them. Interactive bits (buttons, inputs) are plain elements with
 * the `.btn` / `.input` classes from globals.css.
 */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/** Top of every page: optional back link, title, one-line description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
          <Icon name="chevron-left" className="h-3.5 w-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-8 text-fg">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/** A titled block within a page. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconName;
  tone?: 'default' | 'accent' | 'danger' | 'success' | 'warning';
  href?: string;
}) {
  const toneCls = {
    default: 'text-fg-muted bg-muted',
    accent: 'text-accent-text bg-accent-soft',
    danger: 'text-danger-text bg-danger-soft',
    success: 'text-success-text bg-success-soft',
    warning: 'text-warning-text bg-warning-soft',
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {icon && (
          <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', toneCls)}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-fg tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-fg-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card card-interactive block p-4">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function EmptyState({
  icon = 'sparkles',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-fg-muted">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = 'danger',
  title,
  children,
  className,
}: {
  tone?: 'danger' | 'warning' | 'success' | 'info' | 'accent';
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const cls = {
    danger: 'border-danger/25 bg-danger-soft text-danger-text',
    warning: 'border-warning/25 bg-warning-soft text-warning-text',
    success: 'border-success/25 bg-success-soft text-success-text',
    info: 'border-info/25 bg-info-soft text-info-text',
    accent: 'border-accent/20 bg-accent-soft text-accent-text',
  }[tone];
  const icon: IconName = tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'sparkles';
  return (
    <div className={cx('flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm', cls, className)}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(!!title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

/** Inline loading indicator. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[13px] text-fg-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emphasis border-t-accent" />
      {label}
    </div>
  );
}

export function ProgressBar({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'success' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-emphasis', className)}>
      <div className={cx('h-full rounded-full transition-all', tone === 'success' ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  );
}
