'use client';

import { attachmentHref, type Attachment, type NoteDetail } from '@pkb/contracts';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useProjects } from '@/features/projects/api';
import { errorMessage } from '@/shared/http';
import { CheckEnglishButton } from '@/features/english/CheckEnglish';
import { NoteAiTools } from './NoteAiTools';
import { MarkdownEditor } from '@/shared/markdown/MarkdownEditor';
import { Button, Input, Select, Tag } from '@/shared/ui/primitives';
import { toast } from '@/shared/ui/toast';
import { notesApi } from '../api';
import { noteKeys, useDeleteNote, useSaveNote } from '../queries';

function isImage(mime: string) {
  return mime.startsWith('image/');
}
function mdFor(a: Attachment) {
  return isImage(a.mime) ? `![${a.filename}](${attachmentHref(a.id)})` : `[📎 ${a.filename}](${attachmentHref(a.id)})`;
}
function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function NoteEditor({ note, defaults }: { note?: NoteDetail; defaults?: { projectId?: string; taskId?: string; taskTitle?: string } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const projects = useProjects();
  const save = useSaveNote();
  const del = useDeleteNote();
  const [id, setId] = useState(note?.id);
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [projectId, setProjectId] = useState<string | null>(note?.projectId ?? defaults?.projectId ?? null);
  const [taskId, setTaskId] = useState<string | null>(note?.taskId ?? defaults?.taskId ?? null);
  const taskTitle = note?.taskTitle ?? defaults?.taskTitle;
  const [attachments, setAttachments] = useState<Attachment[]>(note?.attachments ?? []);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dirty = !note || title !== note.title || content !== note.content || tags.join() !== note.tags.join() || projectId !== note.projectId || taskId !== note.taskId;

  function input() {
    return { title: title.trim() || 'Untitled note', content, tags, taskId, projectId: taskId ? null : projectId };
  }

  async function persist(): Promise<string> {
    const saved = await save.mutateAsync({ id, input: input() });
    qc.setQueryData(noteKeys.one(saved.id), saved);
    if (!id) {
      setId(saved.id);
      router.replace(`/notes/${saved.id}`);
    }
    return saved.id;
  }

  function insertAtCursor(text: string) {
    const el = editorRef.current;
    if (!el) return setContent((c) => (c ? `${c}\n${text}` : text));
    const { selectionStart: s, selectionEnd: e } = el;
    setContent((c) => c.slice(0, s) + text + c.slice(e));
  }

  async function upload(files: File[]) {
    let noteId = id;
    try {
      if (!noteId) noteId = await persist();
      for (const f of files) {
        setUploading((n) => n + 1);
        try {
          const a = await notesApi.upload(noteId, f);
          setAttachments((xs) => [...xs, a]);
          if (isImage(a.mime)) insertAtCursor(`\n${mdFor(a)}\n`);
        } finally {
          setUploading((n) => n - 1);
        }
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="h-12 border-0 px-0 text-2xl font-semibold focus:ring-0"
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 's' && (e.preventDefault(), persist())}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {taskId ? (
          <span className="flex items-center gap-2 rounded-md bg-muted px-2 py-1">
            Task: <strong className="font-medium">{taskTitle ?? 'task'}</strong>
            <button className="text-xs text-fg-muted hover:text-red-600" onClick={() => setTaskId(null)} title="Detach from task">✕</button>
          </span>
        ) : (
          <label className="flex items-center gap-2">
            Project
            <Select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)}>
              <option value="">— none (general knowledge) —</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <Tag key={t} name={t} onClick={() => setTags(tags.filter((x) => x !== t))} />
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="add tag (bug-fix, architecture…)"
            className="h-7 w-56 text-xs"
          />
        </div>
      </div>

      <MarkdownEditor
        ref={editorRef}
        value={content}
        onChange={setContent}
        minRows={18}
        onPasteFiles={upload}
        placeholder="Write in Markdown. Paste or drop files to attach them."
        toolbarExtras={
          <>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <Button size="sm" variant="ghost" type="button" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
              {uploading ? `Uploading ${uploading}…` : '📎 Attach'}
            </Button>
            <NoteAiTools
              title={title}
              content={content}
              tags={tags}
              onAddTags={(t) => setTags([...tags, ...t.filter((x) => !tags.includes(x))])}
              onReplaceContent={setContent}
            />
            <CheckEnglishButton
              text={content}
              onApply={setContent}
              shortcut
              source={`Note: ${title.trim() || 'Untitled note'}`}
              sourceUrl={id ? `/notes/${id}` : undefined}
            />
          </>
        }
      />

      {attachments.length > 0 && (
        <div className="rounded-md border border-line">
          <div className="border-b border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Attachments</div>
          <ul className="divide-y divide-line">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <a href={attachmentHref(a.id)} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline">
                  {isImage(a.mime) ? '🖼' : '📄'} {a.filename}
                </a>
                <span className="text-xs text-fg-subtle">{fmtSize(a.size)}</span>
                <Button size="sm" variant="ghost" onClick={() => insertAtCursor(`\n${mdFor(a)}\n`)}>Insert</Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!confirm(`Delete ${a.filename}?`)) return;
                    await notesApi.removeAttachment(a.id);
                    setAttachments((xs) => xs.filter((x) => x.id !== a.id));
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => persist().then(() => toast('Saved'))} disabled={save.isPending || !dirty}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <span className="text-xs text-fg-subtle">⌘/Ctrl+S in the title · {dirty ? 'unsaved changes' : 'saved'}</span>
        {id && (
          <Button
            className="ml-auto"
            variant="danger"
            onClick={() => confirm('Delete this note and its attachments?') && del.mutate(id, { onSuccess: () => router.push('/notes') })}
          >
            Delete note
          </Button>
        )}
      </div>
      {taskId && (
        <p className="text-xs text-fg-muted">
          <Link href={`?task=${taskId}`} className="hover:underline">Open the task</Link>
        </p>
      )}
    </div>
  );
}
