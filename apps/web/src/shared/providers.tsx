'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from './http';
import { ToastHost, toast } from './ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
        // One place to surface failed writes.
        mutationCache: new MutationCache({ onError: (e) => toast(errorMessage(e), 'error') }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastHost />
    </QueryClientProvider>
  );
}
