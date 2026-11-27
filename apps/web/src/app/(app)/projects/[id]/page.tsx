'use client';

import { describeRule, TASK_STATUSES } from '@pkb/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDeleteProject, useProject, useSaveProject } from '@/features/projects/api';
import { NoteList } from '@/features/notes/components/NoteList';
import { Kanban } from '@/features/tasks/components/Kanban';
import { NewTaskForm } from '@/features/tasks/components/NewTaskForm';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { useBoard, useRecurrences, useUpdateRecurrence } from '@/features/tasks/queries';
import { Markdown } from '@/shared/markdown/Markdown';
import { Dialog } from '@/shared/ui/dialog';
import { Button, cx, Empty, ProjectDot, Spinner } from '@/shared/ui/primitives';
import { ProjectForm } from '../ProjectForm';

type View = 'board' | 'list' | 'notes' | 'recurring';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const project = useProject(params.id);
  const [view, setView] = useState<View>('board');
  const [includeOldDone, setIncludeOldDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const board = useBoard(params.id, includeOldDone);
  const save = useSaveProject();
  const del = useDeleteProject();
  const router = useRouter();

  if (project.isLoading) return <Spinner />;
  if (!project.data) return <Empty>Project not found.</Empty>;
  const p = project.data;
  const tasks = board.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <ProjectDot color={p.color} /> {p.name}
            {p.archivedAt && <span className="text-sm font-normal text-fg-subtle">(archived)</span>}
          </h1>
          {p.description && <div className="mt-1 text-sm text-fg-secondary"><Markdown>{p.description}</Markdown></div>}
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
        <Button size="sm" onClick={() => save.mutate({ id: p.id, input: { archived: !p.archivedAt } })}>
          {p.archivedAt ? 'Unarchive' : 'Archive'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => confirm('Delete this project? Only possible when it has no tasks or notes.') && del.mutate(p.id, { onSuccess: () => router.push('/projects') })}
        >
          Delete
        </Button>
      </header>

      <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto border-b border-line">
        {(['board', 'list', 'notes', 'recurring'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cx('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm capitalize', view === v ? 'border-accent font-medium' : 'border-transparent text-fg-muted hover:text-fg')}
          >
            {v}
          </button>
        ))}
        {(view === 'board' || view === 'list') && (
          <label className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap pl-2 text-xs text-fg-muted">
            <input type="checkbox" checked={includeOldDone} onChange={(e) => setIncludeOldDone(e.target.checked)} className="accent-[rgb(var(--accent))]" />
            Show older done
          </label>
        )}
      </div>

      {(view === 'board' || view === 'list') && <NewTaskForm projectId={p.id} />}

      {view === 'board' && (board.isLoading ? <Spinner /> : <Kanban projectId={p.id} tasks={tasks} includeOldDone={includeOldDone} />)}

      {view === 'list' &&
        (board.isLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-5">
            {TASK_STATUSES.map((s) => {
              const xs = tasks.filter((t) => t.status === s).sort((a, b) => b.priority - a.priority || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
              return xs.length ? (
                <section key={s}>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{s} · {xs.length}</h2>
                  <div className="rounded-lg border border-line bg-surface p-1">
                    {xs.map((t) => <TaskRow key={t.id} task={t} />)}
                  </div>
                </section>
              ) : null;
            })}
            {!tasks.length && <Empty>No tasks yet.</Empty>}
          </div>
        ))}

      {view === 'notes' && (
        <div className="space-y-3">
          <Link href={`/notes/new?projectId=${p.id}`}><Button variant="primary" size="sm">+ New project note</Button></Link>
          <NoteList query={{ projectId: p.id }} />
        </div>
      )}

      {view === 'recurring' && <Recurring projectId={p.id} />}

      <Dialog open={editing} onClose={() => setEditing(false)}>
        <ProjectForm project={p} onDone={() => setEditing(false)} />
      </Dialog>
    </div>
  );
}

function Recurring({ projectId }: { projectId: string }) {
  const q = useRecurrences(projectId);
  const upd = useUpdateRecurrence();
  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <Empty>No recurring tasks. Use “More → Repeat” when adding a task.</Empty>;
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface">
      {q.data.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <span className="flex-1">
            <span className="font-medium">{r.title}</span>
            <span className="ml-2 text-fg-muted">↻ {describeRule(r.rule)}</span>
          </span>
          <span className={cx('rounded px-1.5 py-0.5 text-xs', r.status === 'active' ? 'bg-success-soft text-success-text' : 'bg-muted text-fg-muted')}>{r.status}</span>
          {r.status === 'active' ? (
            <Button size="sm" onClick={() => upd.mutate({ id: r.id, input: { status: 'paused' } })}>Pause</Button>
          ) : (
            <Button size="sm" onClick={() => upd.mutate({ id: r.id, input: { status: 'active' } })}>Resume</Button>
          )}
          {r.status !== 'ended' && (
            <Button size="sm" variant="danger" onClick={() => confirm('End this series?') && upd.mutate({ id: r.id, input: { status: 'ended' } })}>End</Button>
          )}
        </div>
      ))}
    </div>
  );
}
