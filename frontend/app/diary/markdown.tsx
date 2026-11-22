'use client';

import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cx } from '../components/ui';

/** Diary entries are Markdown (GFM); a single newline is a line break, as people type in a diary. */
export function DiaryMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cx('prose-kb break-words text-[15px] text-fg', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Rough plain text of a Markdown entry, for search. */
export function plainText(md: string): string {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~\-|]/g, ' ');
}

export function wordCount(md: string): number {
  return plainText(md).split(/\s+/).filter(Boolean).length;
}
