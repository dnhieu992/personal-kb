'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** Task details open as a dialog addressed by ?task=<id>, so any page can link to a task. */
export function useTaskDialog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskId = params.get('task');
  const set = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(params.toString());
      if (id) p.set('task', id);
      else p.delete('task');
      const s = p.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { taskId, open: (id: string) => set(id), close: () => set(null) };
}
