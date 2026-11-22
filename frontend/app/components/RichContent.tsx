'use client';

import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { cx } from './ui';

/**
 * Shows what RichEditor wrote (sanitised HTML). Entries saved before the editor
 * existed are plain text and keep their line breaks.
 */
export default function RichContent({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    if (!/^\s*</.test(content)) return null;
    if (typeof window === 'undefined' || !DOMPurify.isSupported) return '';
    return DOMPurify.sanitize(content, { ADD_ATTR: ['target'] });
  }, [content]);

  if (html === null) {
    return <p className={cx('whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg', className)}>{content}</p>;
  }
  return <div className={cx('prose-kb break-words text-[15px] text-fg', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
