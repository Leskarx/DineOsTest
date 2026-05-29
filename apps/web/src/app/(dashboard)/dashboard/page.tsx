'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiFetch, apiPost } from '@/lib/api';
import { TrendingUp, ShoppingBag, AlertTriangle, IndianRupee, Clock, ChefHat, Users, CheckCircle, Play, Square, X, Gift, RotateCcw, Ban, Timer, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20',
  confirmed: 'text-blue-400 bg-blue-900/20',
  preparing: 'text-purple-400 bg-purple-900/20',
  ready: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20',
  served: 'text-slate-900 dark:text-slate-400 bg-slate-50 dark:bg-slate-800',
};

/** Modal for opening a new shift */
function OpenShiftModal({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  const [openingCash, setOpeningCash] = useState('0');
  const mutation = useMutation({
    mutationFn: () => apiPost('/api/v1/shifts/open', { openingCash: parseFloat(openingCash) || 0 }),
    onSuccess: () => { toast.success('Shift opened'); onOpened(); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to open shift'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">Open Shift</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div>
          <label className="label">Opening Cash in Drawer (₹)</label>
          <input className="input text-xl font-bold" type="number" min="0" step="0.50"
            value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} autoFocus />
          <div className="flex gap-2 mt-2 flex-wrap">
            {[0, 500, 1000, 2000, 5000].map((v) => (
              <button key={v} onClick={() => setOpeningCash(String(v))}
                className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300">₹{v}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1">
            <Play size={14} /> {mutation.isPending ? 'Opening...' : 'Open Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal for closing the current shift */
function CloseShiftModal({ shiftId, onClose, onClosed }: { shiftId: string; onClose: () => void; onClosed: () => void }) {
  const [closingCash, setClosingCash] = useState('0');
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiPost(`/api/v1/shifts/${shiftId}/close`, { closingCash: parseFloat(closingCash) || 0, notes }),
    onSuccess: () => { toast.success('Shift closed'); onClosed(); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to close shift'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">Close Shift</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div>
          <label className="label">Closing Cash Count (₹)</label>
          <input className="input text-xl font-bold" type="number" min="0" step="0.50"
            value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={2} placeholder="Any handover notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-danger flex-1">
            <Square size={14} /> {mutation.isPending ? 'Closing...' : 'Close Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { branchId } = useAuthStore();
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => apiFetch('/api/v1/reports/dashboard').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const today = dayjs().format('YYYY-MM-DD');
  const { data: hourly } = useQuery({
    queryKey: ['hourly', branchId, today],
    queryFn: () => apiFetch(`/api/v1/reports/hourly?date=${today}`).then((r) => r.data),
  });

  // Active (open) orders — poll every 20s
  const { data: activeOrders } = useQuery({
    queryKey: ['active-orders', branchId],
    queryFn: () => apiFetch('/api/v1/orders?status=pending,confirmed,preparing,ready&limit=8').then((r) => r.data),
    refetchInterval: 20_000,
  });

  // FIXED: Current shift - properly extract the nested data property
  const { data: shiftResponse, refetch: refetchShift } = useQuery({
    queryKey: ['current-shift', branchId],
    queryFn: () => apiFetch('/api/v1/shifts/current').catch(() => ({ data: null })),
    refetchInterval: 60_000,
  });

  // Extract the actual shift object (or null if no active shift)
  const shift = shiftResponse?.data?.data || null;
  console.log('shiftResponse = ', shiftResponse);
  console.log('shift = ', shift);

  const stats = [
    { label: "Today's Sales", value: `₹${Number(summary?.todaySales || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-amber-600 dark:text-amber-400' },
    { label: "Today's Bills", value: summary?.todayBills || 0, icon: ShoppingBag, color: 'text-blue-400' },
    { label: 'Active Orders', value: summary?.pendingOrders || 0, icon: Clock, color: 'text-purple-400' },
    { label: 'Low Stock Alerts', value: summary?.lowStockAlerts || 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-900 dark:text-slate-400">{dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>

        {/* Shift Status Widget - Now correctly shows "No Active Shift" when shift is closed */}
        {shift ? (
          <div className="flex items-center gap-3 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <ChefHat size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-300 font-medium text-sm">Shift Open</span>
              </div>
              <p className="text-xs text-emerald-600 mt-0.5">
                {shift.openedBy?.name || 'Staff'} · started {dayjs(shift.startedAt).fromNow(true)} ago
              </p>
            </div>
            <button
              onClick={() => setCloseShiftModal(true)}
              className="ml-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-300 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 border border-red-300 dark:border-red-800 rounded-lg px-2.5 py-1.5 transition-all"
            >
              <Square size={12} /> Close Shift
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpenShiftModal(true)}
            className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-amber-600 rounded-xl px-4 py-2.5 text-sm transition-all group"
          >
            <span className="w-2 h-2 rounded-full bg-slate-500 group-hover:bg-amber-500 transition-colors" />
            <span className="text-slate-900 dark:text-slate-400 group-hover:text-slate-900 dark:text-white">No Active Shift</span>
            <Play size={13} className="text-amber-600 dark:text-amber-400 ml-1" />
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Sales Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Hourly Sales — Today</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly || []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
              <YAxis tick={{ fill: 'var(--chart-axis-text)', fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)' }}
                labelStyle={{ color: 'var(--chart-axis-text)' }}
                formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {(hourly || []).map((_: any, i: number) => (
                  <Cell key={i} fill={i === dayjs().hour() ? '#f59e0b' : 'var(--chart-bar-bg)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Week summary */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">7-Day Revenue</h2>
              <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
              ₹{Number(summary?.weekSales || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-900 dark:text-slate-400 mt-1">Last 7 days</div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-900 dark:text-slate-500">Avg per Day</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                ₹{Number((summary?.weekSales || 0) / 7).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-900 dark:text-slate-500">Tables Occupied</div>
              <div className="text-lg font-bold text-purple-400">
                {summary?.occupiedTables || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Statistics + Revenue Leakage ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Order Statistics */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Order Statistics — Today</h2>
            <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summary?.orderStats?.successful ?? 0}</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Successful</div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Ban size={15} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summary?.orderStats?.cancelled ?? 0}</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Cancelled</div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/15 flex items-center justify-center flex-shrink-0">
                <Gift size={15} className="text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summary?.orderStats?.complimentary ?? 0}</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Complimentary</div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <RotateCcw size={15} className="text-orange-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{summary?.orderStats?.returns ?? 0}</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Returns</div>
              </div>
            </div>
          </div>
          {/* Avg turnaround */}
          <div className="mt-3 flex items-center gap-2 bg-slate-100/40 dark:bg-slate-800/40 rounded-xl px-4 py-3">
            <Timer size={14} className="text-purple-400 flex-shrink-0" />
            <span className="text-xs text-slate-900 dark:text-slate-400 flex-1">Avg Table Turnaround</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {summary?.tableStats?.avgTurnaroundMinutes ?? 0} min
            </span>
          </div>
        </div>

        {/* Revenue Leakage */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Revenue Leakage — Today</h2>
            <AlertCircle size={15} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Ban size={15} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">Voided Items</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Individual items removed from orders</div>
              </div>
              <div className={`text-xl font-bold ${(summary?.revenuLeakage?.voidedItems ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-500'}`}>
                {summary?.revenuLeakage?.voidedItems ?? 0}
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">Cancelled with Value</div>
                <div className="text-xs text-slate-900 dark:text-slate-500">Orders cancelled after items were added</div>
              </div>
              <div className={`text-xl font-bold ${(summary?.revenuLeakage?.cancelledWithValue ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-500'}`}>
                {summary?.revenuLeakage?.cancelledWithValue ?? 0}
              </div>
            </div>
            {(summary?.revenuLeakage?.voidedItems ?? 0) === 0 && (summary?.revenuLeakage?.cancelledWithValue ?? 0) === 0 && (
              <div className="flex items-center justify-center gap-2 py-4 text-emerald-600/70 text-sm">
                <CheckCircle size={15} />
                <span>No leakage detected today</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Active Orders */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Live Orders</h2>
          </div>
          {activeOrders?.length > 0 && (
            <span className="badge-yellow text-xs">{activeOrders.length} active</span>
          )}
        </div>
        {!activeOrders || activeOrders.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-600">
            <CheckCircle size={20} className="opacity-40" />
            <span className="text-sm">No active orders right now</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="th">Order #</th>
                  <th className="th">Table</th>
                  <th className="th">Type</th>
                  <th className="th">Items</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th">Time</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order: any) => (
                  <tr key={order.id} className="table-row">
                    <td className="td font-medium text-amber-600 dark:text-amber-400">{order.orderNumber}</td>
                    <td className="td">{order.table?.name || <span className="text-slate-900 dark:text-slate-500 italic">—</span>}</td>
                    <td className="td">
                      <span className="badge-slate capitalize text-xs">{order.orderType?.replace('_', ' ')}</span>
                    </td>
                    <td className="td text-slate-900 dark:text-slate-400">{order.itemCount ?? order.items?.length ?? '—'}</td>
                    <td className="td text-right font-bold">₹{Number(order.grandTotal || 0).toFixed(2)}</td>
                    <td className="td">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', ORDER_STATUS_COLOR[order.status] || 'text-slate-900 dark:text-slate-400 bg-slate-50 dark:bg-slate-800')}>
                        {order.status}
                      </span>
                    </td>
                    <td className="td text-slate-900 dark:text-slate-500 text-xs">{dayjs(order.createdAt).fromNow()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {openShiftModal && (
        <OpenShiftModal
          onClose={() => setOpenShiftModal(false)}
          onOpened={() => { refetchShift(); qc.invalidateQueries({ queryKey: ['current-shift'] }); }}
        />
      )}
      {closeShiftModal && shift && (
        <CloseShiftModal
          shiftId={shift.id}
          onClose={() => setCloseShiftModal(false)}
          onClosed={() => { refetchShift(); qc.invalidateQueries({ queryKey: ['current-shift'] }); }}
        />
      )}
    </div>
  );
}