'use client';

import { DEFAULT_TZ, PRIORITIES, todayKey, type RecurrenceRule } from '@pkb/contracts';
import { useState } from 'react';
import { useProjects } from '@/features/projects/api';
import { Button, Input, Select } from '@/shared/ui/primitives';
import { useCreateRecurrence, useCreateTask } from '../queries';
import { RuleEditor } from './RuleEditor';

/** Quick add: type + Enter. "More" reveals priority, due date, pin and repeat. */
export function NewTaskForm({ projectId: fixedProject, pinByDefault }: { projectId?: string; pinByDefault?: boolean }) {
  const projects = useProjects();
  const create = useCreateTask();
  const createRec = useCreateRecurrence();
  const [title, setTitle] = useState('');
  const [more, setMore] = useState(false);
  const [projectId, setProjectId] = useState(fixedProject ?? '');
  const [priority, setPriority] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [pin, setPin] = useState(!!pinByDefault);
  const [repeat, setRepeat] = useState(false);
  const [rule, setRule] = useState<RecurrenceRule>({ kind: 'daily' });

  const pid = fixedProject ?? (projectId || projects.data?.[0]?.id || '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !pid) return;
    if (repeat) {
      await createRec.mutateAsync({ projectId: pid, title: title.trim(), priority, rule, anchorDate: dueDate || todayKey(DEFAULT_TZ), checklistTemplate: [] });
    } else {
      await create.mutateAsync({ projectId: pid, title: title.trim(), priority, status: 'todo', dueDate: dueDate || null, pinnedForToday: pin });
    }
    setTitle('');
    setDueDate('');
    setRepeat(false);
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-2">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} className="basis-full border-0 shadow-none focus:ring-0 sm:min-w-[12rem] sm:basis-0 sm:flex-1" />
        {!fixedProject && (
          <Select value={pid} onChange={(e) => setProjectId(e.target.value)} className="min-w-0 flex-1 sm:max-w-[12rem] sm:flex-none">
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Button type="button" variant="ghost" onClick={() => setMore((m) => !m)}>
          {more ? 'Less' : 'More'}
        </Button>
        <Button type="submit" variant="primary" disabled={!title.trim() || !pid || create.isPending || createRec.isPending}>
          Add
        </Button>
      </div>
      {more && (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line px-1 pt-2 text-sm">
          <label className="flex items-center gap-1.5">
            Priority
            <Select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              {PRIORITIES.map((p, i) => (
                <option key={p} value={i}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-1.5">
            {repeat ? 'Starts' : 'Due'}
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
          </label>
          {!repeat && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Pin for today
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Repeat
          </label>
          {repeat && <RuleEditor value={rule} onChange={setRule} />}
        </div>
      )}
    </form>
  );
}
