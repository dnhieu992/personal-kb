import type { Metadata } from 'next';
import { Icon, IconName } from '../components/icons';
import { Alert, EmptyState, PageHeader, ProgressBar, Section, StatCard } from '../components/ui';

export const metadata: Metadata = { title: 'Design system' };

/**
 * Living style guide. Every token and component the app is built from, rendered
 * with the real classes — so this page is always in sync with the code.
 * Rules and rationale: frontend/DESIGN.md.
 */

const SURFACES = [
  ['canvas', 'Page background'],
  ['surface', 'Cards, panels, inputs'],
  ['subtle', 'Row hover, quiet fills'],
  ['muted', 'Chips, tracks, tags'],
  ['emphasis', 'Progress tracks, pressed'],
] as const;

const TEXT = [
  ['fg', 'Titles, primary text'],
  ['fg-secondary', 'Body, nav items'],
  ['fg-muted', 'Descriptions, metadata'],
  ['fg-subtle', 'Placeholders, hints'],
  ['fg-faint', 'Disabled, decorative'],
] as const;

const STATUS = ['accent', 'danger', 'success', 'warning', 'info'] as const;
const TONES = ['gray', 'accent', 'red', 'orange', 'amber', 'green', 'teal', 'sky', 'blue', 'violet', 'pink'] as const;

const ICONS: IconName[] = [
  'home', 'planner', 'calendar', 'list', 'book', 'folder', 'sparkles', 'chat', 'pen', 'cards', 'quote', 'search',
  'plus', 'check', 'x', 'trash', 'send', 'clock', 'alert', 'target', 'tag', 'chart', 'note', 'more', 'sun', 'moon',
  'monitor', 'sidebar', 'menu', 'palette', 'chevron-left', 'chevron-right', 'chevron-down', 'arrow-right', 'external',
];

function Swatch({ token, note, text = false }: { token: string; note: string; text?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-[15px] font-semibold"
        style={text ? { color: `rgb(var(--${token}))` } : { background: `rgb(var(--${token}))` }}
      >
        {text && 'Aa'}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xs text-fg">{text ? `text-${token}` : `bg-${token}`}</p>
        <p className="text-xs text-fg-muted">{note}</p>
      </div>
    </div>
  );
}

function Spec({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-3 border-b border-line py-4 last:border-0 sm:grid-cols-[180px_1fr]">
      <p className="font-mono text-xs text-fg-muted">{name}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="space-y-14">
      <PageHeader
        title="Design system"
        description="The tokens and components every page is built from. Semantic names, light and dark from the same classes. Toggle the theme in the sidebar to check both."
      />

      {/* ───────────── Principles */}
      <Section title="Principles">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['Calm by default', 'Neutral surfaces, one accent. Color is reserved for meaning: status, area, type.'],
            ['Content first', 'Chrome recedes — thin lines, soft shadows, generous whitespace. Titles carry the hierarchy.'],
            ['Fast to operate', 'Keyboard everywhere (⌘K, N, /, B). Saves are instant; AI runs in the background.'],
          ].map(([t, d]) => (
            <div key={t} className="card p-4">
              <p className="font-medium text-fg">{t}</p>
              <p className="mt-1 text-[13px] text-fg-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────────── Color */}
      <Section title="Color" description="Tokens are RGB channels in globals.css, mapped by tailwind.config.ts. Never use raw palette classes (bg-slate-100) in pages.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card space-y-3 p-4">
            <p className="eyebrow">Surfaces</p>
            {SURFACES.map(([t, n]) => (
              <Swatch key={t} token={t} note={n} />
            ))}
            <Swatch token="line" note="Default border, dividers" />
            <Swatch token="line-strong" note="Inputs, secondary buttons" />
          </div>
          <div className="card space-y-3 p-4">
            <p className="eyebrow">Text</p>
            {TEXT.map(([t, n]) => (
              <Swatch key={t} token={t} note={n} text />
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="eyebrow mb-3">Accent & status — each has DEFAULT · soft · text</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUS.map((s) => (
              <div key={s} className="overflow-hidden rounded-lg border border-line">
                <div className="h-10" style={{ background: `rgb(var(--${s}))` }} />
                <div className="flex h-8 items-center px-2 text-xs font-medium" style={{ background: `rgb(var(--${s}-soft))`, color: `rgb(var(--${s}-text))` }}>
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="eyebrow mb-3">Tones — tags & badges (.chip + .tone-*)</p>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <span key={t} className={`chip tone-${t}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* ───────────── Type */}
      <Section title="Typography" description="Inter (UI) and JetBrains Mono (code, editors). Weight and color carry hierarchy more than size.">
        <div className="card px-4">
          <Spec name="Page title · 22/32 600">
            <span className="text-[22px] font-semibold leading-8 tracking-tight">Good morning</span>
          </Spec>
          <Spec name="Section · 15/24 600">
            <span className="section-title">Recent entries</span>
          </Spec>
          <Spec name="Body · 13.5/20 400">
            <span className="text-sm text-fg-secondary">The default size for UI text, lists and forms.</span>
          </Spec>
          <Spec name="Meta · 12/16">
            <span className="text-xs text-fg-muted">Updated 3 hours ago · 4 tags</span>
          </Spec>
          <Spec name="Eyebrow · 11 uppercase">
            <span className="eyebrow">Knowledge</span>
          </Spec>
          <Spec name="Mono · 13">
            <code className="font-mono text-[13px] text-fg">npm run dev</code>
          </Spec>
        </div>
      </Section>

      {/* ───────────── Shape */}
      <Section title="Shape & depth" description="Radius grows with size: 6px chips, 8px controls, 12px cards. Shadows are soft and only lift what floats.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['shadow-xs', 'Cards, inputs'],
            ['shadow-sm', 'Hovered cards'],
            ['shadow-md', 'Composer, sticky'],
            ['shadow-lg', 'Popovers, dialogs'],
          ].map(([s, n]) => (
            <div key={s} className={`rounded-xl border border-line bg-surface p-4 ${s}`}>
              <p className="font-mono text-xs text-fg">{s}</p>
              <p className="text-xs text-fg-muted">{n}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────────── Buttons */}
      <Section title="Buttons" description=".btn + one variant + optional size. One primary action per view.">
        <div className="card px-4">
          <Spec name="btn-primary">
            <button className="btn btn-primary">
              <Icon name="plus" /> New entry
            </button>
            <button className="btn btn-primary" disabled>
              Disabled
            </button>
          </Spec>
          <Spec name="btn-secondary">
            <button className="btn btn-secondary">Cancel</button>
            <button className="btn btn-secondary">
              <Icon name="cards" /> Review <span className="chip tone-amber -mr-1 px-1.5">12</span>
            </button>
          </Spec>
          <Spec name="btn-ghost / btn-soft">
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-soft">
              <Icon name="sparkles" /> Soft
            </button>
          </Spec>
          <Spec name="btn-danger / -ghost">
            <button className="btn btn-danger">Delete</button>
            <button className="btn btn-danger-ghost">
              <Icon name="trash" /> Remove
            </button>
          </Spec>
          <Spec name="sizes: lg · md · sm · xs">
            <button className="btn btn-primary btn-lg">Large</button>
            <button className="btn btn-primary">Medium</button>
            <button className="btn btn-primary btn-sm">Small</button>
            <button className="btn btn-secondary btn-xs">Tiny</button>
          </Spec>
          <Spec name="btn-icon">
            <button className="btn btn-secondary btn-icon" aria-label="Search">
              <Icon name="search" />
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="More">
              <Icon name="more" />
            </button>
            <button className="btn btn-primary btn-icon" aria-label="Send">
              <Icon name="send" />
            </button>
          </Spec>
        </div>
      </Section>

      {/* ───────────── Forms */}
      <Section title="Form controls" description=".input works for input, select and textarea. Labels sit above, hints below.">
        <div className="card grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input className="input w-full" placeholder="What did you learn?" />
            <p className="hint">Any language — it gets translated on save.</p>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input w-full" defaultValue="INSIGHT">
              <option>INSIGHT</option>
              <option>HOW_TO</option>
            </select>
          </div>
          <div>
            <label className="label">Small (.input-sm)</label>
            <input className="input input-sm w-full" placeholder="Filter by tag" />
          </div>
          <div>
            <label className="label">With icon</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input className="input w-full pl-9" placeholder="Search…" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input w-full" rows={3} placeholder="Markdown supported" />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" defaultChecked /> Fix my English &amp; collect mistakes
          </label>
        </div>
      </Section>

      {/* ───────────── Feedback & data */}
      <Section title="Feedback & data">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Left today" value={5} icon="planner" tone="accent" hint="3 of 8 done" />
          <StatCard label="Overdue" value={2} icon="alert" tone="danger" hint="Move them to today" />
          <StatCard label="To review" value={14} icon="cards" tone="warning" />
          <StatCard label="Entries" value={248} icon="book" hint="+3 today" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Alert tone="danger" title="Could not reach the backend.">Check that the API is running.</Alert>
          <Alert tone="success">Đã gửi 5 cụm từ vào Telegram.</Alert>
          <Alert tone="warning">Kept exactly as you typed it.</Alert>
          <Alert tone="accent" title="AI on save">Formats as Markdown and translates to English.</Alert>
        </div>
        <div className="card space-y-3 p-4">
          <ProgressBar value={0.62} />
          <ProgressBar value={0.35} tone="success" />
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            Shortcuts look like <span className="kbd">⌘K</span> <span className="kbd">N</span> <span className="kbd">/</span>
          </div>
        </div>
        <EmptyState
          icon="book"
          title="No entries yet"
          description="Empty states say what's missing and offer the one action that fixes it."
          action={
            <button className="btn btn-primary btn-sm">
              <Icon name="plus" /> New entry
            </button>
          }
        />
      </Section>

      {/* ───────────── Icons */}
      <Section title="Icons" description="One line family: 24px grid, 1.75 stroke, round caps. <Icon name=… /> from components/icons.tsx. Emoji only inside user content.">
        <div className="card grid grid-cols-4 gap-1 p-3 sm:grid-cols-7 lg:grid-cols-9">
          {ICONS.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1.5 rounded-lg py-3 text-fg-secondary hover:bg-subtle">
              <Icon name={n} className="h-5 w-5" />
              <span className="font-mono text-2xs text-fg-subtle">{n}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
