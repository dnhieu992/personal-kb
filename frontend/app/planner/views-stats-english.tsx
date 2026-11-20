'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  AREA_LABEL,
  AREAS,
  Area,
  GoalPeriod,
  PCorrection,
  StatsResponse,
  SHORT_DAYS,
  addDays,
  addMonths,
  dayMonth,
  monthTitle,
  shortDateTime,
  weekdayOf,
  weekNumber,
} from '../lib/planner';
import { usePlanner } from './state';
import { Header } from './views-tasks';
import { AreaBadge, EmptyState, ProgressBar, Segmented } from './ui';

const pct = (d: number, t: number) => (t ? `${Math.floor((d / t) * 100)}%` : '—');

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Card({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function StatsView() {
  const { rev, today, category } = usePlanner();
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [scope, setScope] = useState<Area | 'ALL'>('ALL');
  const [anchor, setAnchor] = useState(today);
  const [s, setS] = useState<StatsResponse | null>(null);
  const area = scope === 'ALL' ? undefined : scope;

  useEffect(() => {
    api.planner.stats(period, anchor, area).then(setS).catch(() => {});
  }, [period, anchor, area, rev]);

  const step = (n: number) => setAnchor(period === 'week' ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const days: string[] = [];
  if (s) for (let k = s.from; k <= s.to; k = addDays(k, 1)) days.push(k);
  const isCurrent = !!s && today >= s.from && today <= s.to;
  const subtitle = s
    ? period === 'week'
      ? `Week ${weekNumber(s.from)} · ${dayMonth(s.from)} – ${dayMonth(s.to)}`
      : monthTitle(s.from)
    : '';

  const total = s?.days.reduce((a, d) => a + d.total, 0) ?? 0;
  const done = s?.days.reduce((a, d) => a + d.done, 0) ?? 0;
  const goalsDone = s?.goals.filter((g) => g.done).length ?? 0;
  const areaTotals = AREAS.map((a) => {
    const ds = s?.days.filter((d) => d.area === a) ?? [];
    return { area: a, total: ds.reduce((x, d) => x + d.total, 0), done: ds.reduce((x, d) => x + d.done, 0) };
  });
  const perDay = days.map((k) => {
    const rows = s?.days.filter((d) => d.date === k) ?? [];
    const w = rows.find((r) => r.area === 'WORK');
    const p = rows.find((r) => r.area === 'PERSONAL');
    const open = rows.reduce((x, r) => x + r.total - r.done, 0);
    return { k, work: w?.done ?? 0, personal: p?.done ?? 0, open, total: rows.reduce((x, r) => x + r.total, 0) };
  });
  const maxDay = Math.max(1, ...perDay.map((d) => d.total));

  return (
    <div className="flex flex-col gap-4">
      <Header
        title="Stats"
        subtitle={subtitle}
        right={
          <>
            <Segmented
              value={scope}
              onChange={setScope}
              options={[{ value: 'ALL' as const, label: 'All' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]}
            />
            <Segmented value={period} onChange={(p) => setPeriod(p)} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
            {!isCurrent && (
              <button className="rounded-md px-2 py-1 text-sm text-indigo-600 hover:bg-indigo-50" onClick={() => setAnchor(today)}>
                {period === 'week' ? 'This week' : 'This month'}
              </button>
            )}
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
              <button className="px-2 py-1 hover:bg-slate-100" aria-label="Previous" onClick={() => step(-1)}>
                ‹
              </button>
              <button className="border-l border-slate-300 px-2 py-1 hover:bg-slate-100" aria-label="Next" onClick={() => step(1)}>
                ›
              </button>
            </div>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Completed" value={`${done}/${total}`} color={area ? AREA_COLOR[area] : '#16A34A'} />
        <Card title="Rate" value={pct(done, total)} color="#2563EB" />
        <Card title="Overdue now" value={String(area ? s?.overdue[area] ?? 0 : s?.overdue.total ?? 0)} color="#DC2626" />
        <Card title="Goals met" value={`${goalsDone}/${s?.goals.length ?? 0}`} color="#9333EA" />
      </div>

      {!area && (
        <Box title="Work vs Personal">
          <div className="space-y-2.5">
            {areaTotals.map((a) => (
              <div key={a.area} className="flex items-center gap-3 text-sm">
                <AreaBadge area={a.area} className="w-28 shrink-0" />
                <ProgressBar value={a.total ? a.done / a.total : 0} color={AREA_COLOR[a.area]} height={10} />
                <span className="w-14 text-right tabular-nums">
                  {a.done}/{a.total}
                </span>
                <span className="w-10 text-right tabular-nums text-slate-500">{pct(a.done, a.total)}</span>
              </div>
            ))}
          </div>
        </Box>
      )}

      <Box title="By day">
        <div className="flex h-48 items-end gap-1">
          {perDay.map((d) => (
            <div key={d.k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className="flex w-full max-w-[36px] flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${(d.total / maxDay) * 100}%` }}
                title={`${d.k}: ${d.work + d.personal} done, ${d.open} not done`}
              >
                {(!area || area === 'WORK') && <div style={{ flexGrow: d.work, background: AREA_COLOR.WORK }} />}
                {(!area || area === 'PERSONAL') && <div style={{ flexGrow: d.personal, background: AREA_COLOR.PERSONAL }} />}
                <div style={{ flexGrow: d.open }} className="bg-slate-300" />
              </div>
              <div className={`text-[10px] ${d.k === today ? 'font-bold text-indigo-600' : 'text-slate-500'}`}>
                {period === 'week' ? `${SHORT_DAYS[weekdayOf(d.k)]} ${Number(d.k.slice(8))}` : Number(d.k.slice(8))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {(!area || area === 'WORK') && <Legend color={AREA_COLOR.WORK} label={area ? 'Done' : 'Work · done'} />}
          {(!area || area === 'PERSONAL') && <Legend color={AREA_COLOR.PERSONAL} label={area ? 'Done' : 'Personal · done'} />}
          <Legend color="#CBD5E1" label="Not done" />
        </div>
      </Box>

      <Box title="By category">
        {!s?.categories.length ? (
          <div className="text-sm text-slate-400">No data yet</div>
        ) : (
          <div className="space-y-2.5">
            {s.categories.map((c) => {
              const cat = category(c.categoryId);
              const color = cat?.color ?? AREA_COLOR[c.area];
              return (
                <div key={`${c.area}-${c.categoryId}`} className="flex items-center gap-3 text-sm">
                  {!area && <span className="w-4 text-xs">{c.area === 'WORK' ? '💼' : '👤'}</span>}
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="w-32 shrink-0 truncate">{cat?.name ?? 'General'}</span>
                  <ProgressBar value={c.total ? c.done / c.total : 0} color={color} height={8} />
                  <span className="w-14 text-right tabular-nums">
                    {c.done}/{c.total}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Box>

      {!!s?.goals.length && (
        <Box title={period === 'week' ? 'Weekly goals' : 'Monthly goals'}>
          <div className="space-y-2.5">
            {s.goals.map((g) => (
              <div key={g.id} className="flex items-center gap-3 text-sm">
                <span>{g.done ? '🏅' : '🎯'}</span>
                <span className="w-48 shrink-0 truncate">{g.title}</span>
                <ProgressBar value={g.progressTotal ? g.progressDone / g.progressTotal : 0} color={AREA_COLOR[g.area]} height={8} />
                <span className="w-14 text-right tabular-nums">
                  {g.progressDone}/{g.progressTotal}
                </span>
              </div>
            ))}
          </div>
        </Box>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

const KIND_LABEL: Record<PCorrection['kind'], string> = {
  task: 'Task',
  checklist: 'Checklist',
  goal: 'Goal',
  noteTitle: 'Note title',
  text: 'Note',
};

export function EnglishView() {
  const { rev, run, meta } = usePlanner();
  const [rows, setRows] = useState<PCorrection[] | null>(null);
  useEffect(() => {
    api.planner.corrections().then(setRows).catch(() => setRows([]));
  }, [rev]);

  return (
    <div className="flex flex-col gap-3">
      <Header
        title="English"
        subtitle={
          meta?.englishEnabled
            ? 'Everything you write is auto-corrected to natural English (Vietnamese gets translated). Each fix is logged here.'
            : 'English auto-correct is off — set ANTHROPIC_API_KEY on the backend to enable it.'
        }
        right={
          !!rows?.length && (
            <button
              className="rounded-md px-2.5 py-1 text-sm text-red-600 hover:bg-red-50"
              onClick={() => confirm('Clear the whole correction log? (Texts stay as they are.)') && run(api.planner.clearCorrections())}
            >
              Clear log
            </button>
          )
        }
      />
      {rows && !rows.length && <EmptyState icon="📖" text="No corrections yet" />}
      <div className="space-y-2">
        {(rows ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{KIND_LABEL[c.kind]}</span>
              {shortDateTime(c.createdAt)}
              <div className="ml-auto flex gap-2">
                {c.canRevert && (
                  <button className="text-indigo-600 hover:underline" onClick={() => run(api.planner.revertCorrection(c.id))}>
                    Revert
                  </button>
                )}
                <button className="hover:text-red-600" onClick={() => run(api.planner.deleteCorrection(c.id))}>
                  Remove
                </button>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-red-600/80 line-through decoration-red-300">{c.original}</div>
            <div className="whitespace-pre-wrap text-emerald-700">{c.corrected}</div>
            {c.why && <div className="mt-1 text-xs text-slate-500">💡 {c.why}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
