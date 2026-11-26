'use client';

import { useEffect } from 'react';

/** Centered modal: Esc / click outside / × closes; body scrolls inside. */
export function Dialog({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-xl bg-surface shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-fg-subtle hover:bg-muted hover:text-fg-secondary" aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
