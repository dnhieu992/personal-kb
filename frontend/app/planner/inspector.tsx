'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  PGoal,
  PRIORITY_LABEL,
  PTaskDetail,
  RecurrenceKind,
  MONDAY_FIRST,
  SHORT_DAYS,
  durationLabel,
  goalPeriodLabel,
  hhmm,
  recurrenceSummary,
  shortDateTime,
  toLocalInput,
  weekdayOf,
} from '../lib/planner';
import { usePlanner } from './state';
import { CategoryPicker, CheckBox, EditableTitle, MarkdownField, Segmented, Spinner, cx } from './ui';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[32px] items-center gap-3">
      <div className="w-20 shrink-0 text-xs text-fg-muted">{label}</div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">{children}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-3">
      <div className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {title}
        <div className="ml-auto normal-case">{right}</div>
      </div>
      {children}
    </section>
  );
}

const input = 'min-w-0 max-w-full input input-sm';

export function Inspector() {
  const { selectedTaskId: id, openTask, rev, run, today, category } = usePlanner();
  const [t, setT] = useState<PTaskDetail | null>(null);
  const [goals, setGoals] = useState<PGoal[]>([]);
  const [newItem, setNewItem] = useState('');
  const [link, setLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return setT(null);
    let alive = true;
    api.planner
      .task(id)
      .then((d) => alive && setT(d))
      .catch(() => alive && openTask(null));
    return () => {
      alive = false;
    };
  }, [id, rev, openTask]);

  useEffect(() => {
    if (t) api.planner.goals(t.area, true).then(setGoals).catch(() => {});
  }, [t?.area, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id || !t || t.id !== id) {
    return id ? <div className="p-6 text-sm text-fg-subtle">Loading…</div> : null;
  }

  const patch = (body: Record<string, unknown>) => run(api.planner.updateTask(t.id, body));
  const color = category(t.categoryId)?.color ?? AREA_COLOR[t.area];
  const rec = t.recurrence;
  const setRec = (kind: RecurrenceKind | null, weekdays = rec?.weekdays ?? 0, monthDay?: number) => {
    if (kind === 'weekly' && !weekdays) weekdays = 1 << weekdayOf(t.date ?? today);
    run(api.planner.setRecurrence(t.id, { kind, weekdays, monthDay }));
  };

  const addItem = async () => {
    const v = newItem.trim();
    if (!v) return;
    setNewItem('');
    await run(api.planner.addChecklist(t.id, v));
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const refs = await api.uploadImages(Array.from(files));
      for (const r of refs) await api.planner.addAttachment(t.id, { kind: 'file', value: r.url, title: r.name || 'image' });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
      run(Promise.resolve());
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="pt-1">
          <CheckBox done={t.done} color={color} size={22} onToggle={() => patch({ done: !t.done })} />
        </div>
        <div className="min-w-0 flex-1">
          <EditableTitle
            value={t.title}
            className={cx('block text-base font-semibold', t.done && 'text-fg-subtle line-through')}
            onSave={(v) => v && patch({ title: v })}
          />
          {t.englishPending && (
            <div className="mt-1 text-xs text-fg-subtle">
              <Spinner /> Checking English…
            </div>
          )}
          {t.correction && (
            <div className="mt-1 rounded-md bg-success-soft px-2 py-1 text-xs text-success-text">
              ✨ Corrected from “{t.correction.original}”
              {t.correction.why && <span className="text-success-text/80"> — {t.correction.why}</span>}
              <button
                className="ml-1 underline"
                onClick={() => run(api.planner.revertCorrection(t.correction!.id))}
              >
                Revert
              </button>
            </div>
          )}
        </div>
        <button className="rounded px-2 text-lg text-fg-subtle hover:bg-muted" title="Close" onClick={() => openTask(null)}>
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="space-y-1">
          <Field label="Category">
            <CategoryPicker area={t.area} value={t.categoryId} onChange={(c) => patch({ categoryId: c })} />
          </Field>
          <Field label="Priority">
            <Segmented
              value={t.priority}
              onChange={(p) => patch({ priority: p })}
              options={PRIORITY_LABEL.map((l, i) => ({ value: i, label: l }))}
            />
          </Field>
          <Field label="Date">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!t.date} disabled={!!t.recurrenceId} onChange={(e) => patch({ date: e.target.checked ? today : null })} />
              {!t.date && <span className="text-fg-subtle">Backlog</span>}
            </label>
            {t.date && (
              <input
                type="date"
                className={input}
                value={t.date}
                disabled={!!t.recurrenceId}
                onChange={(e) => e.target.value && patch({ date: e.target.value })}
              />
            )}
          </Field>
          <Field label="Start">
            <input type="checkbox" checked={t.startTime != null} onChange={(e) => patch({ startTime: e.target.checked ? 9 * 60 : null })} />
            {t.startTime != null && (
              <input
                type="time"
                className={input}
                value={hhmm(t.startTime)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  if (!isNaN(h)) patch({ startTime: h * 60 + (m || 0) });
                }}
              />
            )}
          </Field>
          <Field label="Duration">
            <select className={input} value={t.duration ?? 0} onChange={(e) => patch({ duration: Number(e.target.value) || null })}>
              <option value={0}>—</option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reminder">
            <input
              type="checkbox"
              checked={!!t.reminderAt}
              onChange={(e) => {
                if (!e.target.checked) return patch({ reminderAt: null });
                const d = new Date(`${t.date ?? today}T00:00:00`);
                d.setMinutes(t.startTime != null ? Math.max(0, t.startTime - 10) : 9 * 60);
                patch({ reminderAt: d.toISOString() });
              }}
            />
            {t.reminderAt && (
              <input
                type="datetime-local"
                className={input}
                value={toLocalInput(t.reminderAt)}
                onChange={(e) => e.target.value && patch({ reminderAt: new Date(e.target.value).toISOString() })}
              />
            )}
            {t.reminderAt && <span className="text-xs text-fg-subtle">via Telegram</span>}
          </Field>
          <Field label="Goal">
            <select className={input} value={t.goalId ?? 0} onChange={(e) => patch({ goalId: Number(e.target.value) || null })}>
              <option value={0}>None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} · {goalPeriodLabel(g)}
                </option>
              ))}
              {t.goalId && !goals.some((g) => g.id === t.goalId) && <option value={t.goalId}>(finished goal)</option>}
            </select>
          </Field>
          <Field label="Repeat">
            <select
              className={input}
              value={rec?.kind ?? 'none'}
              onChange={(e) => setRec(e.target.value === 'none' ? null : (e.target.value as RecurrenceKind))}
            >
              <option value="none">Never</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays (Mon–Fri)</option>
              <option value="weekly">Specific weekdays</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          {rec?.kind === 'weekly' && (
            <Field label="">
              {MONDAY_FIRST.map((d) => {
                const on = (rec.weekdays & (1 << d)) !== 0;
                return (
                  <button
                    key={d}
                    className={cx('rounded-md px-1.5 py-0.5 text-xs', on ? 'bg-accent text-white' : 'tone-gray')}
                    onClick={() => {
                      const w = rec.weekdays ^ (1 << d);
                      if (w) setRec('weekly', w);
                    }}
                  >
                    {SHORT_DAYS[d]}
                  </button>
                );
              })}
            </Field>
          )}
          {rec?.kind === 'monthly' && (
            <Field label="">
              Day
              <input
                type="number"
                min={1}
                max={31}
                className={cx(input, 'w-16')}
                value={rec.monthDay}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 31) setRec('monthly', 0, v);
                }}
              />
              of every month
            </Field>
          )}
          {rec && <div className="pl-[92px] text-xs text-fg-subtle">🔁 {recurrenceSummary(rec)} · edits apply to future occurrences</div>}
          <Field label="Tags">
            <input
              key={t.tags.join(',')}
              className={cx(input, 'flex-1')}
              defaultValue={t.tags.map((x) => '#' + x).join(' ')}
              placeholder="#tag #another"
              onBlur={(e) => {
                const tags = e.target.value.split(/[\s,]+/).map((s) => s.replace(/^#/, '')).filter(Boolean);
                if (tags.join(',') !== t.tags.join(',')) patch({ tags });
              }}
            />
          </Field>
        </div>

        <Section title={`Checklist${t.checklist.length ? ` · ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : ''}`}>
          <div className="space-y-1">
            {t.checklist.map((c) => (
              <div key={c.id} className="group flex items-center gap-2">
                <CheckBox done={c.done} color={color} size={16} onToggle={() => run(api.planner.updateChecklist(c.id, { done: !c.done }))} />
                <EditableTitle
                  value={c.title}
                  className={cx('flex-1 text-sm', c.done && 'text-fg-subtle line-through')}
                  onSave={(v) => (v ? run(api.planner.updateChecklist(c.id, { title: v })) : run(api.planner.deleteChecklist(c.id)))}
                />
                {t.checklistPending.includes(c.id) && <Spinner title="Checking English…" />}
                <button
                  className="invisible text-fg-subtle hover:text-danger-text group-hover:visible"
                  onClick={() => run(api.planner.deleteChecklist(c.id))}
                >
                  ×
                </button>
              </div>
            ))}
            <input
              className="w-full rounded-md border border-dashed border-line-strong px-2 py-1 text-sm outline-none focus:border-accent/40"
              placeholder="+ Add a step"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
            />
          </div>
        </Section>

        <Section title="Notes">
          <MarkdownField key={`n${t.id}`} value={t.notes ?? ''} onSave={(v) => patch({ notes: v })} placeholder="Details, context…" />
        </Section>

        <Section title="Result">
          <MarkdownField
            key={`r${t.id}`}
            value={t.result ?? ''}
            minRows={3}
            onSave={(v) => patch({ result: v })}
            placeholder="What came out of it (short summary)"
          />
        </Section>

        <Section
          title="Links & files"
          right={
            <button className="text-xs link" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '+ Image'}
            </button>
          }
        >
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          <div className="space-y-1">
            {t.attachments.map((a) => (
              <div key={a.id} className="group flex items-center gap-2 text-sm">
                <span>{a.kind === 'link' ? '🔗' : '🖼️'}</span>
                <a href={a.value} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate link" title={a.value}>
                  {a.title}
                </a>
                <button className="invisible text-fg-subtle hover:text-danger-text group-hover:visible" onClick={() => run(api.planner.deleteAttachment(a.id))}>
                  ×
                </button>
              </div>
            ))}
            <input
              className="w-full rounded-md border border-dashed border-line-strong px-2 py-1 text-sm outline-none focus:border-accent/40"
              placeholder="+ Paste a link and press Enter"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && link.trim()) {
                  run(api.planner.addAttachment(t.id, { kind: 'link', value: link.trim() }));
                  setLink('');
                }
              }}
            />
          </div>
        </Section>

        <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-fg-subtle">
          <span>Created {shortDateTime(t.createdAt)}</span>
          <button
            className="text-danger-text hover:underline"
            onClick={() => {
              if (!confirm(t.recurrenceId ? 'Delete this occurrence?' : 'Delete this task?')) return;
              openTask(null);
              run(api.planner.deleteTask(t.id));
            }}
          >
            🗑 Delete task
          </button>
        </div>
      </div>
    </div>
  );
}
