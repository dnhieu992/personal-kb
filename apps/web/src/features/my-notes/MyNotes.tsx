'use client';

import type { DiaryEntry } from '@pkb/contracts';
import { addDays, DEFAULT_TZ, todayKey } from '@pkb/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/shared/http';
import { MarkdownEditor } from '@/shared/markdown/MarkdownEditor';
import { Icon } from '@/shared/ui/icons';
import { Button, cx, Input, Spinner } from '@/shared/ui/primitives';
import { toast } from '@/shared/ui/toast';
import { uploadImages } from '@/shared/upload-images';
import { lockApi, notesApi } from './api';
import { NoteMarkdown, plainText } from './markdown';
import { PasscodePad } from './PasscodePad';

/** Lock again when the tab has been in the background this long (like a phone). */
const HIDDEN_LOCK_MS = 60_000;

type Unlock = { token: string; expiresAt: number };

/**
 * My Notes: private notes filed by day, behind a 6-digit passcode. The unlock token lives in
 * this component's state only — leaving the page, a reload, the token expiring (30 min) or the
 * tab sitting in the background for a minute all lock it again.
 */
export function MyNotes() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupFirst, setSetupFirst] = useState<string | null>(null);

  useEffect(() => {
    lockApi
      .state()
      .then((s) => setConfigured(s.configured))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const lock = useCallback(() => setUnlock(null), []);

  // Expiry + background lock.
  useEffect(() => {
    if (!unlock) return;
    const t = setTimeout(lock, Math.max(0, unlock.expiresAt - Date.now()));
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_LOCK_MS) lock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [unlock, lock]);

  const accept = (r: { token: string; expiresAt: string }) => {
    setError(null);
    setUnlock({ token: r.token, expiresAt: new Date(r.expiresAt).getTime() });
  };

  if (configured === null) return error ? <p className="text-sm text-danger-text">{error}</p> : <Spinner />;

  if (unlock) return <NotesBook token={unlock.token} onLock={lock} />;

  if (!configured) {
    return setupFirst === null ? (
      <PasscodePad
        title="Create a passcode"
        subtitle="My Notes is private. Pick 6 digits — you'll enter them every time you open it."
        error={error}
        onComplete={(c) => {
          setError(null);
          setSetupFirst(c);
        }}
      />
    ) : (
      <PasscodePad
        key="confirm"
        title="Confirm passcode"
        subtitle="Enter the same 6 digits again."
        error={error}
        footer={
          <button className="hover:text-fg" onClick={() => setSetupFirst(null)}>
            Start over
          </button>
        }
        onComplete={async (c) => {
          if (c !== setupFirst) {
            setSetupFirst(null);
            setError("Passcodes didn't match — try again");
            return false;
          }
          try {
            accept(await lockApi.setup(c));
            setConfigured(true);
          } catch (e) {
            setError(errorMessage(e));
            return false;
          }
        }}
      />
    );
  }

  return (
    <PasscodePad
      title="My Notes is locked"
      subtitle="Enter your passcode"
      error={error}
      onComplete={async (c) => {
        try {
          accept(await lockApi.unlock(c));
        } catch (e) {
          const msg = errorMessage(e);
          setError(/too many/i.test(msg) ? 'Too many tries — wait a minute' : 'Wrong passcode');
          return false;
        }
      }}
    />
  );
}

// ───────────────────────────────── the notebook ─────────────────────────────────

const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions) => new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', opts);
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function dayTitle(key: string, today: string) {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return fmtDay(key, { weekday: 'long' });
}

function NotesBook({ token, onLock }: { token: string; onLock: () => void }) {
  const api = useMemo(() => notesApi(token), [token]);
  const today = todayKey(DEFAULT_TZ);
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [day, setDay] = useState(today);
  const [q, setQ] = useState('');
  const [daysOpen, setDaysOpen] = useState(false);

  const fail = useCallback(
    (e: unknown) => {
      const msg = errorMessage(e);
      if (/locked/i.test(msg)) onLock();
      else toast(msg);
    },
    [onLock],
  );

  useEffect(() => {
    api.list().then(setEntries).catch(fail);
  }, [api, fail]);

  const byDay = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    for (const e of entries ?? []) m.set(e.entryDate, [...(m.get(e.entryDate) ?? []), e]);
    return m;
  }, [entries]);

  const days = useMemo(() => {
    const keys = [...new Set([today, ...byDay.keys()])].sort().reverse();
    const needle = q.trim().toLowerCase();
    return needle ? keys.filter((k) => (byDay.get(k) ?? []).some((e) => plainText(e.content).toLowerCase().includes(needle))) : keys;
  }, [byDay, today, q]);

  const dayEntries = [...(byDay.get(day) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const goto = (k: string) => {
    setDay(k > today ? today : k);
    setDaysOpen(false);
  };

  const upsert = (e: DiaryEntry) => setEntries((xs) => [e, ...(xs ?? []).filter((x) => x.id !== e.id)]);

  if (!entries) return <Spinner />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-[22px] font-semibold leading-8">My Notes</h1>
          <p className="text-[13px] text-fg-muted">
            Private · {entries.length} note{entries.length === 1 ? '' : 's'} on {byDay.size} day{byDay.size === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="outline" size="sm" className="md:hidden" onClick={() => setDaysOpen((v) => !v)}>
          <Icon name="calendar" className="h-3.5 w-3.5" /> All days
        </Button>
        <Button variant="outline" size="sm" onClick={onLock} title="Lock My Notes">
          <Icon name="lock" className="h-3.5 w-3.5" /> Lock
        </Button>
      </header>

      <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className={cx('md:block', daysOpen ? 'block' : 'hidden')}>
          <div className="card overflow-hidden md:sticky md:top-6">
            <div className="border-b border-line p-2">
              <label className="flex h-8 items-center gap-2 rounded-lg bg-canvas px-2.5 text-fg-subtle">
                <Icon name="search" className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search notes…"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
                />
              </label>
            </div>
            <DayList days={days} byDay={byDay} today={today} active={day} onPick={goto} />
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => goto(addDays(day, -1))} aria-label="Previous day">
              <Icon name="chevron-left" />
            </button>
            <div className="min-w-0 flex-1 text-center sm:flex-none sm:text-left">
              <h2 className="text-base font-semibold">{dayTitle(day, today)}</h2>
              <p className="text-xs text-fg-muted">{fmtDay(day, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => goto(addDays(day, 1))}
              disabled={day >= today}
              aria-label="Next day"
            >
              <Icon name="chevron-right" />
            </button>
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              {day !== today && (
                <Button size="sm" variant="ghost" onClick={() => goto(today)}>
                  Today
                </Button>
              )}
              <Input type="date" value={day} max={today} onChange={(e) => e.target.value && goto(e.target.value)} className="h-8 w-40 text-[13px]" />
            </div>
          </div>

          <Composer key={day} day={day} onSave={(content) => api.create(content, day).then(upsert)} onError={fail} />

          {dayEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-subtle">Nothing written on this day yet.</p>
          ) : (
            <ul className="space-y-3">
              {dayEntries.map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  onSave={(content) => api.update(e.id, content, e.entryDate).then(upsert)}
                  onDelete={() =>
                    api
                      .remove(e.id)
                      .then(() => setEntries((xs) => (xs ?? []).filter((x) => x.id !== e.id)))
                      .catch(fail)
                  }
                  onError={fail}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function DayList({
  days,
  byDay,
  today,
  active,
  onPick,
}: {
  days: string[];
  byDay: Map<string, DiaryEntry[]>;
  today: string;
  active: string;
  onPick: (k: string) => void;
}) {
  if (!days.length) return <p className="p-4 text-center text-[13px] text-fg-subtle">No matches.</p>;
  let month = '';
  return (
    <ul className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5 md:max-h-[calc(100vh-14rem)]">
      {days.map((k) => {
        const m = k.slice(0, 7);
        const header = m !== month ? fmtDay(k, { month: 'long', year: 'numeric' }) : null;
        month = m;
        const n = byDay.get(k)?.length ?? 0;
        return (
          <li key={k}>
            {header && <p className="eyebrow px-2.5 pb-1 pt-2.5">{header}</p>}
            <button
              onClick={() => onPick(k)}
              className={cx(
                'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors',
                k === active ? 'bg-accent-soft font-medium text-accent-text' : 'text-fg-secondary hover:bg-muted',
              )}
            >
              <span className="w-6 text-right font-semibold tabular-nums">{Number(k.slice(8))}</span>
              <span className="flex-1 truncate">{k === today ? 'Today' : fmtDay(k, { weekday: 'long' })}</span>
              {n > 0 && <span className="rounded-full bg-muted px-1.5 text-2xs tabular-nums text-fg-muted">{n}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function useImageUpload(insert: (md: string) => void, onError: (e: unknown) => void) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const refs = await uploadImages(imgs);
      insert(refs.map((r) => `![${r.name ?? 'image'}](${r.url})`).join('\n'));
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const button = (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload([...(e.target.files ?? [])])} />
      <button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
        <Icon name="image" className="h-3.5 w-3.5" /> {busy ? 'Uploading…' : 'Image'}
      </button>
    </>
  );
  return { upload, button };
}

function Composer({ day, onSave, onError }: { day: string; onSave: (content: string) => Promise<unknown>; onError: (e: unknown) => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { upload, button } = useImageUpload((md) => setText((t) => (t ? `${t}\n${md}` : md)), onError);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(text);
      setText('');
      setOpen(false);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!open && !text)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-4 py-3 text-left text-sm text-fg-subtle hover:border-accent hover:text-fg-muted"
      >
        <Icon name="plus" className="h-4 w-4" /> Write a note for {fmtDay(day, { day: 'numeric', month: 'short' })}…
      </button>
    );

  return (
    <div className="space-y-2" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && (e.preventDefault(), save())}>
      <MarkdownEditor value={text} onChange={setText} minRows={6} placeholder="What's on your mind? Markdown works." onPasteFiles={upload} toolbarExtras={button} />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={!text.trim() || saving}>
          {saving ? 'Saving…' : 'Save note'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setText('');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <span className="ml-auto hidden text-xs text-fg-subtle sm:inline">⌘/Ctrl+Enter to save</span>
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  onSave,
  onDelete,
  onError,
}: {
  entry: DiaryEntry;
  onSave: (content: string) => Promise<unknown>;
  onDelete: () => void;
  onError: (e: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const { upload, button } = useImageUpload((md) => setText((t) => `${t}\n${md}`), onError);
  const edited = new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 60_000;

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="card group p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-fg-subtle">
        <Icon name="clock" className="h-3.5 w-3.5" />
        <span className="tabular-nums">{fmtTime(entry.createdAt)}</span>
        {edited && <span>· edited {fmtTime(entry.updatedAt)}</span>}
        {!editing && (
          <div className="ml-auto flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>
              <Icon name="pen" className="h-3.5 w-3.5" /> Edit
            </button>
            <button className="btn btn-danger-ghost btn-xs" onClick={() => confirm('Delete this note?') && onDelete()}>
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && (e.preventDefault(), save())}>
          <MarkdownEditor value={text} onChange={setText} minRows={6} onPasteFiles={upload} toolbarExtras={button} />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={save} disabled={saving || !text.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(entry.content);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <NoteMarkdown content={entry.content} />
      )}
    </li>
  );
}
