'use client';
/**
 * Superadmin — Overview
 * Platform-wide KPI stats at a glance.
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Building2, Users, CreditCard, ShoppingBag,
  TrendingUp, RefreshCw, Loader2, ArrowRight,
  CheckCircle2, Clock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  tenants: { total: number; active: number };
  subscriptions: { active: number; trial: number; churned: number };
  orders30d: number;
  activeToday: number;
  mrr: number;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className={cn(
      'bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4 transition-colors',
      href && 'hover:border-slate-700 cursor-pointer',
    )}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {href && <ArrowRight size={14} className="text-slate-600 mt-1 flex-shrink-0" />}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Sub breakdown bar ────────────────────────────────────────────────────────

function SubBreakdown({ active, trial, churned }: { active: number; trial: number; churned: number }) {
  const total = active + trial + churned || 1;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-white">Subscription Health</p>
        <Link href="/admin/subscriptions" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden flex gap-0.5 mb-4">
        <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(active / total) * 100}%` }} />
        <div className="bg-amber-500"                   style={{ width: `${(trial   / total) * 100}%` }} />
        <div className="bg-red-500 rounded-r-full"      style={{ width: `${(churned / total) * 100}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active',  count: active,  color: 'text-emerald-400', icon: CheckCircle2 },
          { label: 'Trial',   count: trial,   color: 'text-amber-400',   icon: Clock },
          { label: 'Churned', count: churned, color: 'text-red-400',     icon: AlertTriangle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="text-center">
            <Icon size={14} className={cn('mx-auto mb-1', color)} />
            <p className={cn('text-lg font-bold tabular-nums', color)}>{count}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: '/admin/tenants',       label: 'Manage Tenants',       icon: Building2 },
  { href: '/admin/subscriptions', label: 'View Subscriptions',   icon: CreditCard },
  { href: '/admin/activity',      label: 'Activity Feed',        icon: TrendingUp },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/stats').then(r => r.data.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <p className="text-sm">Failed to load platform stats.</p>
        <button onClick={() => refetch()} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  // Safe destructure — data is confirmed defined here
  const stats: Stats = {
    tenants:       data.tenants       ?? { total: 0, active: 0 },
    subscriptions: data.subscriptions ?? { active: 0, trial: 0, churned: 0 },
    orders30d:     data.orders30d     ?? 0,
    activeToday:   data.activeToday   ?? 0,
    mrr:           data.mrr           ?? 0,
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Platform Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time stats across all tenants</p>
        </div>
        <button
          onClick={() => refetch()}
          className={cn('p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors', isFetching && 'animate-spin')}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Businesses"
          value={stats.tenants.total}
          sub={`${stats.tenants.active} active`}
          icon={Building2}
          color="bg-blue-500/15 text-blue-400"
          href="/admin/tenants"
        />
        <StatCard
          label="Active Subs"
          value={stats.subscriptions.active}
          sub={`${stats.subscriptions.trial} on trial`}
          icon={CreditCard}
          color="bg-emerald-500/15 text-emerald-400"
          href="/admin/subscriptions"
        />
        <StatCard
          label="Orders (30d)"
          value={stats.orders30d.toLocaleString()}
          sub={`${stats.activeToday} businesses active today`}
          icon={ShoppingBag}
          color="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          label="MRR"
          value={`₹${Number(stats.mrr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub="current month billing"
          icon={TrendingUp}
          color="bg-amber-500/15 text-amber-400"
        />
      </div>

      {/* Sub breakdown */}
      <SubBreakdown
        active={stats.subscriptions.active}
        trial={stats.subscriptions.trial}
        churned={stats.subscriptions.churned}
      />

      {/* Quick links */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Links</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
            >
              <Icon size={15} className="text-slate-400 group-hover:text-slate-200 transition-colors" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
              <ArrowRight size={13} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
