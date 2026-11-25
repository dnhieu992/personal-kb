'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PROJECT_STATUS, PProject, ProjectStatus } from '../../lib/planner';
import { Alert, EmptyState, Loading, PageHeader, ProgressBar, Section, StatCard } from '../../components/ui';
import { StatusChip, WeeklyBars, ago, pct } from '../projects';

const STATUS_ORDER: ProjectStatus[] = ['in_progress', 'stalled', 'not_started', 'done'];

/** Progress and status of every project, plus what needs attention. */
export default function ProjectReportPage() {
  const [projects, setProjects] = useState<PProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.planner
      .projects()
      .then(setProjects)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!projects) return <Loading />;

  const header = <PageHeader title="Project report" description="Progress and status of every project." />;
  if (!projects.length)
    return (
      <>
        {header}
        <EmptyState
          icon="chart"
          title="No projects yet"
          action={
            <Link className="btn btn-primary" href="/planner">
              Go to projects
            </Link>
          }
        />
      </>
    );

  const sum = (k: 'total' | 'done' | 'doing' | 'overdue' | 'doneLast7') => projects.reduce((a, p) => a + p[k], 0);
  const total = sum('total');
  const done = sum('done');
  const active = projects.filter((p) => p.status === 'in_progress').length;
  const attention = projects.filter((p) => p.overdue > 0 || p.status === 'stalled');
  const sorted = [...projects].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || pct(b) - pct(a),
  );
  const byStatus = STATUS_ORDER.map((s) => ({ s, n: projects.filter((p) => p.status === s).length })).filter((x) => x.n);

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects.length}
          icon="folder"
          hint={byStatus.map((x) => `${x.n} ${PROJECT_STATUS[x.s].label.toLowerCase()}`).join(' · ')}
        />
        <StatCard
          label="Overall completion"
          value={`${total ? Math.round((done / total) * 100) : 0}%`}
          icon="check"
          tone="success"
          hint={`${done}/${total} tasks done · ${active} active`}
        />
        <StatCard label="Done last 7 days" value={sum('doneLast7')} icon="chart" tone="accent" hint={`${sum('doing')} in progress now`} />
        <StatCard
          label="Overdue tasks"
          value={sum('overdue')}
          icon="alert"
          tone={sum('overdue') ? 'danger' : 'default'}
          hint={sum('overdue') ? 'Across all projects' : 'Nothing overdue'}
        />
      </div>

      {attention.length > 0 && (
        <Section title="Needs attention" className="mt-8">
          <div className="space-y-2">
            {attention.map((p) => (
              <Link key={p.id} href={`/planner/${p.id}`} className="card card-interactive flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-fg">{p.name}</span>
                <StatusChip status={p.status} />
                <span className="text-fg-muted">
                  {[
                    p.overdue > 0 && `${p.overdue} overdue task${p.overdue === 1 ? '' : 's'}`,
                    p.status === 'stalled' && `no activity since ${ago(p.lastActivity)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="All projects" description="Bars: tasks finished per week, last 8 weeks (hover for the number)." className="mt-8">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-fg-muted">
                <th className="px-4 py-2.5">Project</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="w-48 px-3 py-2.5">Progress</th>
                <th className="px-3 py-2.5 text-right">In progress</th>
                <th className="px-3 py-2.5 text-right">To do</th>
                <th className="px-3 py-2.5 text-right">Overdue</th>
                <th className="px-3 py-2.5 text-right">Done 7d</th>
                <th className="px-3 py-2.5">Last 8 weeks</th>
                <th className="px-4 py-2.5">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/planner/${p.id}`} className="font-medium text-fg hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.total ? p.done / p.total : 0} tone={p.status === 'done' ? 'success' : 'accent'} />
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                        {p.done}/{p.total} · {pct(p)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.doing}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.todo}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${p.overdue ? 'font-medium text-danger-text' : 'text-fg-muted'}`}>{p.overdue}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.doneLast7}</td>
                  <td className="px-3 py-3">
                    <WeeklyBars weekly={p.weekly} />
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{ago(p.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
