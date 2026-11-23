'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EnglishCard, EnglishChange, EnglishCheck } from '../../lib/api';
import { Icon } from '../icons';
import { Alert, cx } from '../ui';

export interface EnglishChecker {
  checkEnglish: (content: string) => Promise<EnglishCheck>;
  saveCards: (cards: EnglishCard[], noteId: string | null) => Promise<{ saved: number; skipped: number }>;
}

const KIND: Record<EnglishChange['kind'], { label: string; tone: string }> = {
  vietnamese: { label: 'Từ tiếng Việt', tone: 'tone-sky' },
  vocab: { label: 'Từ vựng', tone: 'tone-violet' },
  grammar: { label: 'Ngữ pháp', tone: 'tone-amber' },
  spelling: { label: 'Chính tả', tone: 'tone-gray' },
  style: { label: 'Diễn đạt', tone: 'tone-green' },
};
const CARD_KIND: Record<EnglishCard['kind'], string> = { VOCAB: 'Từ vựng', MISTAKE: 'Lỗi hay sai', GRAMMAR: 'Ngữ pháp' };

/** Apply the chosen edits one by one (first occurrence each); stale ones are skipped. */
function applyChanges(text: string, changes: EnglishChange[]): string {
  let out = text;
  for (const c of changes) {
    const at = out.indexOf(c.original);
    if (at >= 0) out = out.slice(0, at) + c.replacement + out.slice(at + c.original.length);
  }
  return out;
}

/**
 * "Check English": the AI proofreads the draft, then you pick which fixes to
 * apply and which words to keep as review cards. Nothing changes until you apply.
 */
export function EnglishCheckDialog({
  text,
  noteId,
  checker,
  onApply,
  onClose,
}: {
  text: string;
  noteId: string | null;
  checker: EnglishChecker;
  onApply: (text: string, summary: string) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<EnglishCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Set<number>>(new Set());
  const [cards, setCards] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let live = true;
    checker
      .checkEnglish(text)
      .then((r) => {
        if (!live) return;
        setResult(r);
        setFixes(new Set(r.changes.map((_, i) => i)));
        setCards(new Set(r.cards.map((_, i) => i)));
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [checker, text]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  const counts = useMemo(() => {
    const c: Partial<Record<EnglishChange['kind'], number>> = {};
    for (const ch of result?.changes ?? []) c[ch.kind] = (c[ch.kind] ?? 0) + 1;
    return c;
  }, [result]);

  async function apply() {
    if (!result) return;
    setApplying(true);
    try {
      const chosen = result.changes.filter((_, i) => fixes.has(i));
      // All fixes kept: take the AI's full corrected text (it also fixes what spans several edits).
      const next = chosen.length === result.changes.length ? result.corrected : applyChanges(text, chosen);
      let savedNote = '';
      const pickedCards = result.cards.filter((_, i) => cards.has(i));
      if (pickedCards.length) {
        const r = await checker.saveCards(pickedCards, noteId);
        savedNote = ` · ${r.saved} từ vào ôn tập English${r.skipped ? ` (${r.skipped} đã có)` : ''}`;
      }
      onApply(next, `Đã sửa ${chosen.length} chỗ${savedNote}`);
    } catch (e) {
      setError((e as Error).message);
      setApplying(false);
    }
  }

  const nothing = result && !result.changes.length && !result.cards.length;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-3 md:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Check English"
        className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Icon name="sparkles" className="h-4 w-4 text-accent-text" />
          <h2 className="text-base font-semibold text-fg">Check English</h2>
          {result && !nothing && (
            <span className="flex flex-wrap gap-1">
              {(Object.keys(counts) as EnglishChange['kind'][]).map((k) => (
                <span key={k} className={cx('chip', KIND[k].tone)}>
                  {KIND[k].label} {counts[k]}
                </span>
              ))}
            </span>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm ml-auto" aria-label="Đóng">
            <Icon name="x" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <Alert title="Không kiểm tra được">{error}</Alert>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-fg-muted">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-emphasis border-t-accent" />
              AI đang đọc note… (khoảng 10–40 giây)
            </div>
          ) : nothing ? (
            <div className="py-16 text-center">
              <p className="text-[15px] font-medium text-success-text">Không thấy lỗi nào 🎉</p>
              <p className="mt-1 text-sm text-fg-muted">Tiếng Anh trong note này đã ổn.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {result.changes.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-fg">Sửa ({fixes.size}/{result.changes.length})</h3>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setFixes(fixes.size === result.changes.length ? new Set() : new Set(result.changes.map((_, i) => i)))
                      }
                    >
                      {fixes.size === result.changes.length ? 'Bỏ chọn hết' : 'Chọn hết'}
                    </button>
                  </div>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {result.changes.map((c, i) => (
                      <li key={i}>
                        <label className={cx('flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-subtle', !fixes.has(i) && 'opacity-60')}>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                            checked={fixes.has(i)}
                            onChange={() => setFixes(toggle(fixes, i))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-[14px] leading-relaxed">
                              <del className="rounded bg-danger-soft px-1 text-danger-text decoration-danger-text/60">{c.original}</del>
                              <span className="mx-1.5 text-fg-subtle">→</span>
                              <ins className="rounded bg-success-soft px-1 font-medium text-success-text no-underline">{c.replacement}</ins>
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                              <span className={cx('chip', KIND[c.kind]?.tone ?? 'tone-gray')}>{KIND[c.kind]?.label ?? c.kind}</span>
                              {c.note}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {result.cards.length > 0 && (
                <section>
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-fg">Lưu vào ôn tập English ({cards.size}/{result.cards.length})</h3>
                    <p className="text-xs text-fg-muted">Những từ bạn chưa biết hoặc hay dùng sai — thành thẻ trong English → Review.</p>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {result.cards.map((c, i) => (
                      <li key={i}>
                        <label
                          className={cx(
                            'flex h-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition',
                            cards.has(i) ? 'border-accent/50 bg-accent-soft/40' : 'border-line opacity-60',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                            checked={cards.has(i)}
                            onChange={() => setCards(toggle(cards, i))}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-fg">{c.front}</span>
                              <span className="chip tone-gray">{CARD_KIND[c.kind]}</span>
                            </span>
                            <span className="mt-0.5 block text-[13px] text-fg-secondary">{c.meaning}</span>
                            {c.example && <span className="mt-0.5 block text-xs italic text-fg-muted">{c.example}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle/60 px-5 py-3">
          <span className="text-xs text-fg-subtle">Chưa có gì thay đổi cho tới khi bạn bấm áp dụng.</span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              Đóng
            </button>
            {result && !nothing && (
              <button onClick={apply} disabled={applying || (!fixes.size && !cards.size)} className="btn btn-primary btn-sm">
                <Icon name="check" />
                {applying
                  ? 'Đang áp dụng…'
                  : `Áp dụng${fixes.size ? ` ${fixes.size} sửa` : ''}${cards.size ? `${fixes.size ? ' &' : ''} lưu ${cards.size} từ` : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
