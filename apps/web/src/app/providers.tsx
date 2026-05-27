'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/store/auth.store';

/** Syncs the logged-in user into Sentry for error tracking context */
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

/**
 * Clears the entire React Query cache whenever the active branch changes.
 *
 * WHY THIS IS NEEDED:
 * The API uses x-branch-id HTTP header (set by the axios interceptor in api.ts)
 * to scope every query to the current branch. React Query caches results by
 * queryKey alone — it has NO awareness of request headers.
 *
 * So when a user switches from Branch A → Branch B:
 *   • The axios interceptor immediately starts sending x-branch-id = Branch B ✓
 *   • BUT React Query still serves Branch A's stale cache for any queryKey that
 *     doesn't include branchId (e.g. ['tables'], ['bills',...], ['users'])
 *   • Result: old branch data flashes on screen until the background refetch
 *     completes — looks like a bug.
 *
 * Fix: subscribe to branchId changes. On switch, call queryClient.clear() to
 * wipe the entire in-memory cache, so every page refetches fresh data that is
 * correctly scoped to the new branch.
 */
function BranchCacheGuard({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: React.ReactNode;
}) {
  const branchId = useAuthStore((s) => s.branchId);
  const prevBranchId = useRef<string | null>(null);

  useEffect(() => {
    // Skip the very first mount — nothing to compare against yet.
    if (prevBranchId.current === null) {
      prevBranchId.current = branchId;
      return;
    }

    if (branchId !== prevBranchId.current) {
      // Branch switched — purge the entire cache so every page refetches
      // fresh data scoped to the new branch.
      queryClient.clear();
      prevBranchId.current = branchId;
    }
  }, [branchId, queryClient]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 60s staleTime — the single biggest fix for "every page takes time
            // to load". Previously 30s meant almost every navigation triggered a
            // new API round-trip to a DB in Oregon (US) from India = 200-300ms
            // latency per page. Now cached data is served instantly and a
            // background refetch only happens when data is truly stale.
            staleTime: 60_000,

            // Garbage-collect unused query cache after 2 min (default is 5 min).
            // Keeps memory lean on low-RAM POS tablets during a long shift.
            gcTime: 2 * 60 * 1_000,

            retry: 1,
            refetchOnWindowFocus: false,

            // Return cached data immediately while fetching fresh data in the
            // background. Eliminates the blank loading flash when navigating
            // back to a page that was visited before.
            placeholderData: (previousData: unknown) => previousData,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BranchCacheGuard queryClient={queryClient}>
        <SentryUserSync>{children}</SentryUserSync>
      </BranchCacheGuard>
    </QueryClientProvider>
  );
}
