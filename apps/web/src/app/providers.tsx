'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/store/auth.store';

/** Inner component that sets the Sentry user context after auth is resolved */
function SentryUserSync({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return <>{children}</>;
}

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false } },
  }));

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <SentryUserSync>
          {children}
          <ProgressBar
            height="4px"
            color="#f59e0b"
            options={{ showSpinner: false }}
            shallowRouting
          />
        </SentryUserSync>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
