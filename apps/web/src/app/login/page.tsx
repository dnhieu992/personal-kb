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
      <h1 className="text-lg font-semibold">Personal KB</h1>
      <Input type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button variant="primary" className="w-full" disabled={busy || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
