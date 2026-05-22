'use client';
import { useEffect, useState, useCallback } from 'react';
import { subscriptionWallStore } from '@/store/subscriptionWall.store';

/**
 * Returns whether the current session is subscription-blocked.
 * The actual blocking flag is set by the Axios 402 interceptor in lib/api.ts.
 */
export function useSubscriptionWall() {
  const [state, setState] = useState(subscriptionWallStore.getState());

  useEffect(() => {
    const unsub = subscriptionWallStore.subscribe(setState);
    return () => { unsub(); };
  }, []);

  const dismiss = useCallback(() => subscriptionWallStore.dismiss(), []);

  return {
    isBlocked: state.isBlocked,
    plan: state.plan,
    daysLeft: state.daysLeft,
    dismiss,
  };
}
