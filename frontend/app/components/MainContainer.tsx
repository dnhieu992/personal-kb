'use client';

import { usePathname } from 'next/navigation';

/** Site content column. App-like pages (the Planner) get the full width instead. */
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path?.startsWith('/planner')) return <main>{children}</main>;
  return <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>;
}
