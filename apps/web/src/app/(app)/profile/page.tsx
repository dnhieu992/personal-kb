'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { lockApi } from '@/features/my-notes/api';
import { Avatar } from '@/features/profile/Avatar';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { errorMessage } from '@/shared/http';
import { Icon } from '@/shared/ui/icons';
import { Button, Input, Spinner, Textarea } from '@/shared/ui/primitives';
import { toast } from '@/shared/ui/toast';
import { uploadImages } from '@/shared/upload-images';

export default function ProfilePage() {
  const profile = useProfile();
  if (!profile.data) return <Spinner />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold leading-8">Profile</h1>
        <p className="text-[13px] text-fg-muted">Your name and picture in the sidebar, and the My Notes passcode.</p>
      </header>
      <ProfileForm key={profile.dataUpdatedAt} initial={profile.data} />
      <PasscodeCard />
    </div>
  );
}

function ProfileForm({ initial }: { initial: NonNullable<ReturnType<typeof useProfile>['data']> }) {
  const save = useUpdateProfile();
  const [name, setName] = useState(initial.displayName);
  const [email, setEmail] = useState(initial.email ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [avatar, setAvatar] = useState<{ key: string | null; url: string | null }>({ key: initial.avatarKey, url: initial.avatarUrl });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const [img] = await uploadImages([f]);
      setAvatar({ key: img.key, url: img.url });
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { displayName: name, email: email.trim() || null, bio: bio.trim() || null, avatarKey: avatar.key },
          { onSuccess: () => toast('Profile saved'), onError: (err) => toast(errorMessage(err)) },
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name || '?'} url={avatar.url} size={72} />
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="image" className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : avatar.url ? 'Change picture' : 'Upload picture'}
          </Button>
          {avatar.url && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAvatar({ key: null, url: null })}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Display name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
        </label>
      </div>
      <label className="block">
        <span className="label">About</span>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} placeholder="A line about you (optional)" />
      </label>
      <div className="flex justify-end">
        <Button variant="primary" disabled={save.isPending || !name.trim()}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}

function PasscodeCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  useEffect(() => {
    lockApi.state().then((s) => setConfigured(s.configured)).catch(() => setConfigured(null));
  }, []);

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
          <Icon name="lock" className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-semibold">My Notes passcode</h2>
          <p className="text-[13px] text-fg-muted">6 digits, asked every time you open My Notes.</p>
        </div>
      </div>
      {configured === false ? (
        <p className="text-sm text-fg-secondary">
          No passcode yet — <Link href="/my-notes" className="text-accent-text hover:underline">open My Notes</Link> to create one.
        </p>
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (next !== confirm) return toast("New passcodes don't match");
            setBusy(true);
            try {
              await lockApi.change(current, next);
              setCurrent('');
              setNext('');
              setConfirm('');
              toast('Passcode changed');
            } catch (err) {
              toast(/wrong/i.test(errorMessage(err)) ? 'Current passcode is wrong' : errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {(
            [
              ['Current', current, setCurrent],
              ['New', next, setNext],
              ['Confirm new', confirm, setConfirm],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="block">
              <span className="label">{label}</span>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={(e) => set(digits(e.target.value))}
                placeholder="••••••"
                className="tracking-[0.4em]"
              />
            </label>
          ))}
          <div className="sm:col-span-3 flex justify-end">
            <Button disabled={busy || current.length !== 6 || next.length !== 6 || confirm.length !== 6}>
              {busy ? 'Changing…' : 'Change passcode'}
            </Button>
          </div>
        </form>
      )}
      <p className="text-xs text-fg-subtle">
        Forgot it? On the server run <code className="rounded bg-muted px-1">node dist/scripts/reset-notes-passcode.js</code> — your notes stay, you pick a new passcode.
      </p>
    </section>
  );
}
