'use client';

import { DEFAULT_TZ, PRIORITIES, TASK_STATUSES, todayKey, type TaskDetail } from '@pkb/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProjects } from '@/features/projects/api';
import { useNotes } from '@/features/notes/queries';
import { Markdown } from '@/shared/markdown/Markdown';
import { CheckEnglishButton } from '@/features/english/CheckEnglish';
import { MarkdownEditor } from '@/shared/markdown/MarkdownEditor';
import { Dialog } from '@/shared/ui/dialog';
import { Button, cx, Input, Select, Spinner, Tag } from '@/shared/ui/primitives';
import { useChecklist, useDeleteTask, useSetStatus, useTask, useUpdateRecurrence, useUpdateTask } from '../queries';
import { useTaskDialog } from '../useTaskDialog';

/** Mounted once in the app shell; opens for ?task=<id>. */
export function TaskDialogHost() {
  const { taskId, close } = useTaskDialog();
  return (
    <Dialog open={!!taskId} onClose={close} wide>
      {taskId && <TaskDialogBody id={taskId} onClose={close} />}
    </Dialog>
  );
}

function TaskDialogBody({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useTask(id);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6 text-sm text-fg-muted">Task not found.</div>;
  return <TaskEditor task={q.data} onClose={onClose} />;
}

function TaskEditor({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const update = useUpdateTask(task.id);
  const setStatus = useSetStatus();
  const del = useDeleteTask();
  const projects = useProjects();
  const [title, setTitle] = useState(task.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(task.description ?? '');
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDesc(task.description ?? ''), [task.description]);
  const today = todayKey(DEFAULT_TZ);
  const pinned = task.pinnedFor === today;

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
        <Link href={`/projects/${task.projectId}`} className="hover:underline" onClick={onClose}>
          {task.projectName}
        </Link>
        {task.recurrence && <span>· ↻ {task.recurrence.describe}{task.recurrence.status !== 'active' && ` (${task.recurrence.status})`}</span>}
      </div>
      <div className="mb-4 flex items-center gap-2 pr-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && update.mutate({ title: title.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none"
        />
        <CheckEnglishButton
          compact
          text={title}
          shortcut={!editingDesc}
          source={`Task: ${task.title}`}
          sourceUrl={`/projects/${task.projectId}?task=${task.id}`}
          onApply={(next) => {
            setTitle(next);
            if (next.trim() && next !== task.title) update.mutate({ title: next.trim() });
          }}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Field label="Status">
          <Select value={task.status} onChange={(e) => setStatus.mutate({ id: task.id, status: e.target.value as TaskDetail['status'] })} className="w-full">
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={task.priority} onChange={(e) => update.mutate({ priority: Number(e.target.value) })} className="w-full">
            {PRIORITIES.map((p, i) => (
              <option key={p} value={i}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" value={task.dueDate ?? ''} onChange={(e) => update.mutate({ dueDate: e.target.value || null })} />
        </Field>
        <Field label="Project">
          <Select
            value={task.projectId}
            disabled={!!task.recurrenceId}
            onChange={(e) => update.mutate({ projectId: e.target.value })}
            className="w-full"
          >
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {task.status !== 'done' && (
          <Button variant="primary" size="sm" onClick={() => setStatus.mutate({ id: task.id, status: 'done' })}>
            ✓ Complete
          </Button>
        )}
        <Button size="sm" onClick={() => update.mutate({ pinnedForToday: !pinned })}>
          {pinned ? '📌 Unpin from today' : '📌 Pin for today'}
        </Button>
      </div>

      <Section title="Description" action={!editingDesc && <Button size="sm" variant="ghost" onClick={() => setEditingDesc(true)}>Edit</Button>}>
        {editingDesc ? (
          <div className="space-y-2">
            <MarkdownEditor
              value={desc}
              onChange={setDesc}
              minRows={8}
              toolbarExtras={
                <CheckEnglishButton text={desc} onApply={setDesc} shortcut source={`Task: ${task.title}`} sourceUrl={`/projects/${task.projectId}?task=${task.id}`} />
              }
            />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => update.mutate({ description: desc || null }, { onSuccess: () => setEditingDesc(false) })}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDesc(task.description ?? ''); setEditingDesc(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : task.description ? (
          <div onDoubleClick={() => setEditingDesc(true)}>
            <Markdown>{task.description}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">No description.</p>
        )}
      </Section>

      <Checklist task={task} />
      <TaskNotes task={task} onNavigate={onClose} />
      {task.recurrence && <SeriesControls task={task} />}

      <div className="mt-6 flex justify-end border-t border-line pt-4">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            const msg = task.recurrence && task.status !== 'done' ? 'Delete this occurrence? The next one will be scheduled.' : 'Delete this task?';
            if (confirm(msg)) del.mutate(task.id, { onSuccess: onClose });
          }}
        >
          {task.recurrence && task.status !== 'done' ? 'Skip / delete occurrence' : 'Delete task'}
        </Button>
      </div>
    </div>
  );
}

function Checklist({ task }: { task: TaskDetail }) {
  const { add, update, remove } = useChecklist(task.id);
  const [title, setTitle] = useState('');
  return (
    <Section title={`Checklist ${task.checklistTotal ? `· ${task.checklistDone}/${task.checklistTotal}` : ''}`}>
      <div className="space-y-1">
        {task.checklist.map((c) => (
          <div key={c.id} className="group flex items-center gap-2">
            <input type="checkbox" checked={c.done} onChange={() => update.mutate({ id: c.id, input: { done: !c.done } })} className="accent-[rgb(var(--accent))]" />
            <span className={cx('flex-1 text-sm', c.done && 'text-fg-subtle line-through')}>{c.title}</span>
            <button onClick={() => remove.mutate(c.id)} className="invisible text-xs text-fg-subtle hover:text-danger-text group-hover:visible">
              remove
            </button>
          </div>
        ))}
      </div>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate(title.trim(), { onSuccess: () => setTitle('') });
        }}
      >
        <div className="flex items-center gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item…" className="h-8 flex-1" />
          <CheckEnglishButton compact text={title} onApply={setTitle} source={`Task: ${task.title}`} sourceUrl={`/projects/${task.projectId}?task=${task.id}`} />
        </div>
      </form>
    </Section>
  );
}

function TaskNotes({ task, onNavigate }: { task: TaskDetail; onNavigate: () => void }) {
  const notes = useNotes({ taskId: task.id });
  const items = notes.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Section
      title="Notes"
      action={
        <Link href={`/notes/new?taskId=${task.id}`} onClick={onNavigate}>
          <Button size="sm" variant="ghost">+ New note</Button>
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle">No notes for this task.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} onClick={onNavigate} className="block rounded px-2 py-1.5 hover:bg-subtle">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                  {n.tags.map((t) => <Tag key={t} name={t} />)}
                  {n.attachmentCount > 0 && <span>📎 {n.attachmentCount}</span>}
                  <span className="truncate">{n.excerpt}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SeriesControls({ task }: { task: TaskDetail }) {
  const upd = useUpdateRecurrence();
  const r = task.recurrence!;
  return (
    <Section title="Recurring series">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-fg-secondary">{r.describe} · {r.status}</span>
        {r.status === 'active' && <Button size="sm" onClick={() => upd.mutate({ id: r.id, input: { status: 'paused' } })}>Pause</Button>}
        {r.status !== 'active' && <Button size="sm" onClick={() => upd.mutate({ id: r.id, input: { status: 'active' } })}>Resume</Button>}
        {r.status !== 'ended' && (
          <Button size="sm" variant="danger" onClick={() => confirm('End this series? No new occurrences will be created.') && upd.mutate({ id: r.id, input: { status: 'ended' } })}>
            End series
          </Button>
        )}
      </div>
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

