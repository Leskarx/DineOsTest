'use client';
/**
 * Superadmin — Activity Feed
 * Recent platform-wide events: new orders, tenant registrations.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Activity, RefreshCw, Loader2,
  ShoppingBag, Building2, UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  event_type: 'order_created' | 'tenant_registered';
  id: string;
  tenant_name: string;
  actor_email?: string;
  detail: string;
  created_at: string;
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventIcon({ type }: { type: string }) {
  if (type === 'order_created')    return <ShoppingBag  size={14} className="text-blue-400"    />;
  if (type === 'tenant_registered') return <UserPlus size={14} className="text-emerald-600 dark:text-emerald-400" />;
  return <Activity size={14} className="text-slate-900 dark:text-slate-400" />;
}

function EventRow({ ev }: { ev: ActivityEvent }) {
  const isNew = ev.event_type === 'tenant_registered';
  return (
    <div className={cn(
      'flex items-start gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:bg-slate-800/30 transition-colors',
      isNew && 'bg-emerald-500/5',
    )}>
      <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: isNew ? 'rgba(16,185,129,.12)' : 'rgba(59,130,246,.1)' }}>
        <EventIcon type={ev.event_type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">
          <span className="font-medium text-slate-900 dark:text-white">{ev.tenant_name}</span>
          {' — '}
          <span className="text-slate-900 dark:text-slate-400">{ev.detail}</span>
        </p>
        {ev.actor_email && (
          <p className="text-xs text-slate-900 dark:text-slate-500 mt-0.5">{ev.actor_email}</p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-slate-900 dark:text-slate-500" title={format(new Date(ev.created_at), 'dd MMM yyyy HH:mm')}>
          {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
        </p>
        <p className="text-[10px] text-slate-600 capitalize mt-0.5">
          {ev.event_type.replace('_', ' ')}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LIMITS = [25, 50, 100, 200];

export default function ActivityPage() {
  const [limit, setLimit] = useState(50);

  const { data, isLoading, refetch, isFetching } = useQuery<{ data: ActivityEvent[]; total: number }>({
    queryKey: ['admin-activity', limit],
    queryFn: () => api.get(`/api/v1/admin/activity?limit=${limit}`).then(r => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const events = data?.data ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white">Activity Feed</h1>
          <p className="text-xs text-slate-900 dark:text-slate-500">{events.length} recent platform events</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="input-field py-1 text-xs"
          >
            {LIMITS.map(l => <option key={l} value={l}>Last {l}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className={cn('p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-400 transition-colors', isFetching && 'animate-spin')}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800/60 flex-shrink-0 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-slate-500">
          <ShoppingBag size={11} className="text-blue-400" /> Order created
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-slate-500">
          <Building2 size={11} className="text-emerald-600 dark:text-emerald-400" /> Tenant registered
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-slate-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600">
            <Activity size={32} />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <div>
            {events.map((ev, i) => <EventRow key={`${ev.id}-${i}`} ev={ev} />)}
          </div>
        )}
      </div>
    </div>
  );
}
