/**
 * Tiny pub/sub store (no Zustand dep needed) for subscription wall state.
 * Set by the 402 Axios interceptor; consumed by useSubscriptionWall hook.
 */

export interface SubscriptionWallState {
  isBlocked: boolean;
  plan: string | null;
  daysLeft: number | null;
}

type Listener = (state: SubscriptionWallState) => void;

function createStore() {
  let state: SubscriptionWallState = {
    isBlocked: false,
    plan: null,
    daysLeft: null,
  };
  const listeners = new Set<Listener>();

  function notify() {
    listeners.forEach((fn) => fn(state));
  }

  return {
    getState: () => state,

    /** Called by the Axios 402 interceptor */
    block(plan: string | null, daysLeft: number | null) {
      state = { isBlocked: true, plan, daysLeft };
      notify();
    },

    /** Called when user closes the wall or re-subscribes */
    dismiss() {
      state = { isBlocked: false, plan: null, daysLeft: null };
      notify();
    },

    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const subscriptionWallStore = createStore();
