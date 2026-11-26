'use client';

import type { RecurrenceRule } from '@pkb/contracts';
import { cx, Input, Select } from '@/shared/ui/primitives';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RuleEditor({ value, onChange }: { value: RecurrenceRule; onChange: (r: RecurrenceRule) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.kind}
        onChange={(e) => {
          const k = e.target.value as RecurrenceRule['kind'];
          onChange(
            k === 'daily' ? { kind: 'daily' } : k === 'weekly' ? { kind: 'weekly', weekdays: [1] } : k === 'monthly' ? { kind: 'monthly', day: 1 } : { kind: 'everyNDays', interval: 2 },
          );
        }}
      >
        <option value="daily">Every day</option>
        <option value="weekly">On weekdays…</option>
        <option value="monthly">Monthly on day…</option>
        <option value="everyNDays">Every N days</option>
      </Select>
      {value.kind === 'weekly' && (
        <div className="flex gap-1">
          {DAYS.map((d) => {
            const on = value.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const next = on ? value.weekdays.filter((x) => x !== d) : [...value.weekdays, d];
                  if (next.length) onChange({ kind: 'weekly', weekdays: next });
                }}
                className={cx('h-8 w-10 rounded text-xs', on ? 'bg-accent text-accent-fg' : 'bg-muted text-fg-secondary hover:bg-emphasis')}
              >
                {DAY_LABEL[d]}
              </button>
            );
          })}
        </div>
      )}
      {value.kind === 'monthly' && (
        <Input type="number" min={1} max={31} className="w-20" value={value.day} onChange={(e) => onChange({ kind: 'monthly', day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
      )}
      {value.kind === 'everyNDays' && (
        <Input type="number" min={1} max={365} className="w-20" value={value.interval} onChange={(e) => onChange({ kind: 'everyNDays', interval: Math.min(365, Math.max(1, Number(e.target.value) || 1)) })} />
      )}
    </div>
  );
}
