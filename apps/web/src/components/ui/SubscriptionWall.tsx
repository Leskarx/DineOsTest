'use client';
import { CreditCard, Lock, ArrowRight, X } from 'lucide-react';
import { subscriptionWallStore } from '@/store/subscriptionWall.store';

interface Props {
  plan: string | null;
  daysLeft: number | null;
}

/**
 * Full-screen overlay shown when the API returns HTTP 402 (subscription lapsed).
 * Rendered inside the dashboard layout above the page content.
 */
export function SubscriptionWall({ plan, daysLeft }: Props) {
  const isExpired = daysLeft !== null && daysLeft <= 0;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 card p-8 text-center space-y-6 shadow-2xl border border-amber-800/40">
        {/* Dismiss (only for grace-period warnings, not hard blocks) */}
        {!isExpired && (
          <button
            onClick={() => subscriptionWallStore.dismiss()}
            className="absolute top-4 right-4 text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center">
          {isExpired ? (
            <Lock size={30} className="text-amber-600 dark:text-amber-400" />
          ) : (
            <CreditCard size={30} className="text-amber-600 dark:text-amber-400" />
          )}
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isExpired ? 'Subscription Expired' : 'Subscription Ending Soon'}
          </h2>
          <p className="text-slate-900 dark:text-slate-400 text-sm leading-relaxed">
            {isExpired
              ? 'Your subscription has lapsed. Renew now to restore full access to Dine&Stay OS.'
              : `Your ${plan ?? 'plan'} subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew early to avoid interruption.`}
          </p>
        </div>

        {/* Plan badge */}
        {plan && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 mx-auto">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {plan} plan
          </div>
        )}

        {/* CTA */}
        <div className="space-y-3">
          <a
            href="/settings/billing"
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isExpired ? 'Renew Subscription' : 'Upgrade / Renew'}
            <ArrowRight size={16} />
          </a>

          {!isExpired && (
            <button
              onClick={() => subscriptionWallStore.dismiss()}
              className="text-xs text-slate-900 dark:text-slate-500 hover:text-slate-900 dark:text-slate-400 transition-colors"
            >
              Remind me later
            </button>
          )}
        </div>

        {/* Support note */}
        <p className="text-xs text-slate-600">
          Questions? Contact{' '}
          <a href="mailto:support@dinestay.app" className="text-slate-900 dark:text-slate-500 hover:text-slate-900 dark:text-slate-400 underline">
            support@dinestay.app
          </a>
        </p>
      </div>
    </div>
  );
}
