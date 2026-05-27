'use client';
/**
 * Superadmin — Subscriptions
 * Paginated view of all tenant subscriptions with status filter and plan override.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CreditCard, Search, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, Pencil, X, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  tenant_id: string;
  name: string;
  email: string;
  sub_status: string;
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  plan_name?: string;
  mrr?: number;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    trial:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
    past_due:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
    paused:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', cfg[status] ?? cfg.paused)}>
      {status}
    </span>
  );
}

// ─── Plan Override Modal ──────────────────────────────────────────────────────

function PlanModal({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const qc = useQueryClient();
  const [planCode, setPlanCode] = useState('starter');
  const [subStatus, setSubStatus] = useState(sub.sub_status);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/admin/tenants/${sub.tenant_id}/plan`, { planCode, status: subStatus }).then(r => r.data.data),
    onSuccess: () => {
      toast.success(`Plan updated to ${planCode} (${subStatus})`);
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || 'Plan update failed';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const err = (error as any)?.response?.data?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Override Plan — {sub.name}</h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300"><X size={15} /></button>
        </div>

        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="label">Plan</label>
            <select className="input-field w-full" value={planCode} onChange={e => setPlanCode(e.target.value)}>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Status</label>
            <select className="input-field w-full" value={subStatus} onChange={e => setSubStatus(e.target.value)}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Apply Override
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['', 'active', 'trial', 'past_due', 'cancelled'];

export default function SubscriptionsPage() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [page, setPage]           = useState(1);
  const [editing, setEditing]     = useState<Subscription | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: Subscription[]; total: number; page: number; limit: number }>({
    queryKey: ['admin-subscriptions', search, statusFilter, page],
    queryFn: () =>
      api.get('/api/v1/admin/subscriptions', {
        params: { search: search || undefined, status: statusFilter || undefined, page, limit: 20 },
      }).then(r => r.data.data),
    staleTime: 30_000,
  });

  const rows  = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const pages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Subscriptions</h1>
          <p className="text-xs text-slate-500">{total} subscription records</p>
        </div>
        <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-800/60 flex-shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input-field w-full pl-8 py-1.5 text-sm"
            placeholder="Search tenant name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors capitalize',
                statusFilter === s
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600',
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-slate-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600">
            <CreditCard size={32} />
            <p className="text-sm">No subscriptions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="th">Business</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th">MRR</th>
                <th className="th">Period</th>
                <th className="th">Trial Ends</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.tenant_id} className="table-row">
                  <td className="td">
                    <div className="font-medium text-white">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.email}</div>
                  </td>
                  <td className="td text-slate-300">{s.plan_name ?? '—'}</td>
                  <td className="td"><StatusBadge status={s.sub_status} /></td>
                  <td className="td text-slate-300">
                    {s.mrr != null ? `₹${Number(s.mrr).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="td text-xs text-slate-500">
                    {s.current_period_start
                      ? `${format(new Date(s.current_period_start), 'dd MMM')} – ${s.current_period_end ? format(new Date(s.current_period_end), 'dd MMM yyyy') : '—'}`
                      : '—'}
                  </td>
                  <td className="td text-xs text-slate-500">
                    {s.sub_status === 'trial' && s.trial_ends_at ? format(new Date(s.trial_ends_at), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="td">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditing(s)}
                        title="Override plan"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 flex-shrink-0">
          <span className="text-xs text-slate-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-slate-400 px-2">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page === pages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {editing && <PlanModal sub={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
