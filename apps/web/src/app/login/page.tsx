'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { authApi } from '@/features/auth/api';
import { errorMessage } from '@/shared/http';
import { Button, Input } from '@/shared/ui/primitives';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/today';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await authApi.login({ password });
          router.replace(next.startsWith('/') ? next : '/today');
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="mb-2 flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-fg shadow-sm">K</span>
        <div>
          <h1 className="text-lg font-semibold">Personal KB</h1>
          <p className="text-[13px] text-fg-muted">Sign in to continue</p>
        </div>
      </div>
      <Input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-danger-text">{error}</p>}
      <Button variant="primary" className="w-full" disabled={busy || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
