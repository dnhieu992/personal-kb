'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'kb.theme';

/**
 * Runs in <head> before first paint so there is no light flash in dark mode.
 * Keep it tiny and dependency-free — it is inlined as a string.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>('system');

  useEffect(() => {
    try {
      setPref((localStorage.getItem(KEY) as ThemePref) || 'system');
    } catch {
      /* storage blocked: stay on system */
    }
  }, []);

  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);

  const set = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  };
  return { pref, set };
}

const ORDER: ThemePref[] = ['system', 'light', 'dark'];
const ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;
const LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

/** Three-way segmented theme switch (expanded sidebar) or a cycling icon button (rail). */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { pref, set } = useTheme();
  if (compact) {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    return (
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set(next)} title={`${LABEL[pref]} — switch to ${LABEL[next].toLowerCase()}`}>
        <Icon name={ICON[pref]} />
      </button>
    );
  }
  return (
    <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Theme">
      {ORDER.map((p) => (
        <button
          key={p}
          role="radio"
          aria-checked={pref === p}
          title={LABEL[p]}
          onClick={() => set(p)}
          className={`flex h-6 flex-1 items-center justify-center rounded-md transition ${
            pref === p ? 'bg-surface text-fg shadow-xs' : 'text-fg-subtle hover:text-fg'
          }`}
        >
          <Icon name={ICON[p]} className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
