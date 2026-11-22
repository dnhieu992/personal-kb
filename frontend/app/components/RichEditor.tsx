'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { api } from '../lib/api';
import { Icon, IconName } from './icons';
import { cx } from './ui';

/** Old entries are plain text; turn them into paragraphs so the editor keeps the line breaks. */
export function toEditorHtml(content: string): string {
  if (!content || /^\s*</.test(content)) return content;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return content
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Text of a stored entry (HTML or plain), for search and counts. */
export function plainText(content: string): string {
  return content.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|h\d|li|blockquote|pre)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

interface Props {
  /** HTML; '' when empty. */
  value: string;
  onChange: (html: string) => void;
  /** ⌘/Ctrl + Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Buttons for the footer's right side (e.g. Save / Cancel). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Forum-style post composer: formatting toolbar, WYSIWYG body (Tiptap), image
 * upload by button, paste or drop (stored on R2 via /uploads/images), and a
 * footer with the word count and the caller's actions. Emits HTML.
 */
export default function RichEditor({ value, onChange, onSubmit, placeholder, autoFocus, actions, className }: Props) {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  async function insertImages(editor: Editor, files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return false;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await api.uploadImages(images);
      for (const img of uploaded) editor.chain().focus().setImage({ src: img.url, alt: img.name ?? '' }).run();
    } catch (e) {
      setError(`Tải ảnh lỗi: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
    return true;
  }

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? 'Viết gì đó…' }),
      Extension.create({
        name: 'submitShortcut',
        addKeyboardShortcuts: () => ({
          'Mod-Enter': () => {
            submitRef.current?.();
            return true;
          },
        }),
      }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: { class: 'prose-kb' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.some((f) => f.type.startsWith('image/')) || !editorRef.current) return false;
        void insertImages(editorRef.current, files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.some((f) => f.type.startsWith('image/')) || !editorRef.current) return false;
        event.preventDefault();
        void insertImages(editorRef.current, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // The parent clears the draft after saving: mirror that into the editor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) editor.commands.setContent(toEditorHtml(value), false);
  }, [value, editor]);

  function openLink() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  }

  function applyLink(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    const url = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) chain.unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    } else chain.setLink({ href: url }).run();
    setLinkOpen(false);
  }

  const words = plainText(value).split(/\s+/).filter(Boolean).length;

  type Tool = { icon: IconName; title: string; run: () => void; active?: boolean; text?: string };
  const groups: Tool[][] = editor
    ? [
        [
          { icon: 'bold', title: 'Đậm (⌘B)', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
          { icon: 'italic', title: 'Nghiêng (⌘I)', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
          { icon: 'underline', title: 'Gạch chân (⌘U)', run: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
          { icon: 'strike', title: 'Gạch ngang', run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
        ],
        [
          { icon: 'heading', text: '2', title: 'Tiêu đề lớn', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
          { icon: 'heading', text: '3', title: 'Tiêu đề nhỏ', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
        ],
        [
          { icon: 'list', title: 'Danh sách', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
          { icon: 'list-ordered', title: 'Danh sách số', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
          { icon: 'quote-block', title: 'Trích dẫn', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
          { icon: 'code', title: 'Khối code', run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
          { icon: 'divider', title: 'Đường kẻ ngang', run: () => editor.chain().focus().setHorizontalRule().run() },
        ],
        [
          { icon: 'link', title: 'Chèn link', run: openLink, active: editor.isActive('link') },
          { icon: 'image', title: 'Chèn ảnh (hoặc dán / kéo thả ảnh vào)', run: () => fileRef.current?.click() },
        ],
      ]
    : [];

  return (
    <div className={cx('rich-editor card overflow-hidden focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15', className)}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-subtle px-2 py-1.5">
        {groups.map((group, gi) => (
          <div key={gi} className={cx('flex items-center gap-0.5', gi > 0 && 'ml-1 border-l border-line pl-1.5')}>
            {group.map((t) => (
              <button
                key={t.title}
                type="button"
                title={t.title}
                aria-label={t.title}
                aria-pressed={t.active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.run}
                className={cx(
                  'flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-fg-secondary transition hover:bg-muted hover:text-fg',
                  t.active && 'bg-accent-soft text-accent-text hover:bg-accent-soft hover:text-accent-text',
                )}
              >
                <Icon name={t.icon} className="h-4 w-4" strokeWidth={2} />
                {t.text && <span className="-ml-0.5 mt-1.5 text-[10px] font-semibold">{t.text}</span>}
              </button>
            ))}
          </div>
        ))}
        {editor && (
          <div className="ml-auto flex items-center gap-0.5">
            <button type="button" title="Hoàn tác (⌘Z)" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-muted hover:text-fg disabled:opacity-30">
              <Icon name="undo" className="h-4 w-4" />
            </button>
            <button type="button" title="Làm lại (⇧⌘Z)" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-muted hover:text-fg disabled:opacity-30">
              <Icon name="redo" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {linkOpen && (
        <form onSubmit={applyLink} className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <Icon name="link" className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setLinkOpen(false)}
            placeholder="https://… (để trống để bỏ link)"
            className="input input-sm w-full"
          />
          <button type="submit" className="btn btn-primary btn-sm">Áp dụng</button>
          <button type="button" onClick={() => setLinkOpen(false)} className="btn btn-ghost btn-sm">Huỷ</button>
        </form>
      )}

      <EditorContent editor={editor} />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (editor) void insertImages(editor, files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-subtle/60 px-3 py-2">
        <span className="text-xs text-fg-subtle">
          {uploading ? 'Đang tải ảnh…' : error ? <span className="text-danger-text">{error}</span> : `${words} từ · ⌘/Ctrl + Enter để lưu`}
        </span>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
