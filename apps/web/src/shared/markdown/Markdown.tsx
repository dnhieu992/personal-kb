'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders note/task markdown. Attachment images use the stable in-app URL
 * (/api/attachments/<id>/raw) which redirects to a short-lived presigned URL.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-accent prose-img:rounded-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...p }) => <a {...p} target={p.href?.startsWith('/') ? undefined : '_blank'} rel="noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
