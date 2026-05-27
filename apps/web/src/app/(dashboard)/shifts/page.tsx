'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { Clock, DollarSign, Lock, Unlock, IndianRupee, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const DENOMS = [
  { key: 'note2000', label: '₹2000', value: 2000 },
  { key: 'note500', label: '₹500', value: 500 },
  { key: 'note200', label: '₹200', value: 200 },
  { key: 'note100', label: '₹100', value: 100 },
  { key: 'note50', label: '₹50', value: 50 },
  { key: 'note20', label: '₹20', value: 20 },
  { key: 'note10', label: '₹10', value: 10 },
  { key: 'coin5', label: '₹5', value: 5 },
  { key: 'coin2', label: '₹2', value: 2 },
  { key: 'coin1', label: '₹1', value: 1 },
];

function DenominationCount({ label, counts, onChange }: { label: string; counts: Record<string, number>; onChange: (k: string, v: number) => void }) {
  const total = DENOMS.reduce((s, d) => s + (counts[d.key] || 0) * d.value, 0);
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">{label}</h3>
        <span className="text-amber-600 dark:text-amber-400 font-bold text-lg">₹{total.toLocaleString('en-IN')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DENOMS.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span className="text-xs text-slate-900 dark:text-slate-400 w-14">{d.label}</span>
            <input type="number" min={0} value={counts[d.key] || 0}
              onChange={(e) => onChange(d.key, parseInt(e.target.value) || 0)}
              className="input text-center py-1 text-sm w-16" />
            <span className="text-xs text-slate-900 dark:text-slate-500 w-16 text-right">= ₹{((counts[d.key] || 0) * d.value).toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { branchId, tenantId } = useAuthStore();
  const [openingCounts, setOpeningCounts] = useState<Record<string, number>>({});
  const [closingCounts, setClosingCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);

  const { data: activeShift } = useQuery({ queryKey: ['activeShift', branchId], queryFn: () => apiFetch('/api/v1/shifts/active').then((r) => r.data) });
  const { data: shifts } = useQuery({ queryKey: ['shifts', branchId], queryFn: () => apiFetch('/api/v1/shifts').then((r) => r.data) });
  const { data: shiftSummary } = useQuery({ queryKey: ['shiftSummary', selectedShift?.id], queryFn: () => apiFetch(`/api/v1/shifts/${selectedShift?.id}/summary`).then((r) => r.data), enabled: !!selectedShift });

  const openingTotal = DENOMS.reduce((s, d) => s + (openingCounts[d.key] || 0) * d.value, 0);
  const closingTotal = DENOMS.reduce((s, d) => s + (closingCounts[d.key] || 0) * d.value, 0);

  const openMutation = useMutation({
    mutationFn: () => apiPost('/api/v1/shifts/open', { openingCash: openingTotal, denominations: openingCounts }),
    onSuccess: () => { toast.success('Shift opened!'); qc.invalidateQueries({ queryKey: ['activeShift'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); setShowOpen(false); setOpeningCounts({}); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to open shift'),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiPost(`/api/v1/shifts/${activeShift.id}/close`, { closingCash: closingTotal, denominations: closingCounts, notes }),
    onSuccess: (data) => { toast.success('Shift closed!'); qc.invalidateQueries({ queryKey: ['activeShift'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); setShowClose(false); setSelectedShift(data.data); setClosingCounts({}); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to close shift'),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Shift Management</h1>
        {!activeShift ? (
          <button onClick={() => setShowOpen(true)} className="btn-primary"><Unlock size={14} /> Open Shift</button>
        ) : (
          <button onClick={() => setShowClose(true)} className="btn-danger"><Lock size={14} /> Close Shift</button>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift && (
        <div className="card border-emerald-800/50 bg-emerald-900/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-bold text-emerald-600 dark:text-emerald-400">Active Shift — {activeShift.shiftNumber}</h2>
            <span className="text-xs text-slate-900 dark:text-slate-400">Since {dayjs(activeShift.openedAt).format('h:mm A')}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: `₹${Number(activeShift.totalSales || 0).toLocaleString('en-IN')}`, icon: TrendingUp },
              { label: 'Orders', value: activeShift.totalOrders || 0, icon: Clock },
              { label: 'Cash Sales', value: `₹${Number(activeShift.cashSales || 0).toLocaleString('en-IN')}`, icon: IndianRupee },
              { label: 'Opening Cash', value: `₹${Number(activeShift.openingCash || 0).toLocaleString('en-IN')}`, icon: DollarSign },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-900 dark:text-slate-400 mb-1">{label}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!activeShift && (
        <div className="card text-center py-8 text-slate-900 dark:text-slate-500">
          <Lock size={32} className="mx-auto mb-2 opacity-30" />
          <p>No active shift. Open a shift to start accepting orders.</p>
        </div>
      )}

      {/* Shift History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">Shift History</div>
        <table className="w-full">
          <thead className="bg-slate-100/50 dark:bg-slate-800/50"><tr><th className="th">Shift</th><th className="th">Opened</th><th className="th">Closed</th><th className="th text-right">Sales</th><th className="th text-right">Cash</th><th className="th">Diff</th><th className="th">Status</th></tr></thead>
          <tbody>
            {shifts?.map((s: any) => (
              <tr key={s.id} className="table-row cursor-pointer" onClick={() => setSelectedShift(s)}>
                <td className="td font-medium">{s.shiftNumber}</td>
                <td className="td text-xs text-slate-900 dark:text-slate-400">{dayjs(s.openedAt).format('D MMM, h:mm A')}</td>
                <td className="td text-xs text-slate-900 dark:text-slate-400">{s.closedAt ? dayjs(s.closedAt).format('D MMM, h:mm A') : '—'}</td>
                <td className="td text-right text-amber-600 dark:text-amber-400 font-medium">₹{Number(s.totalSales || 0).toLocaleString('en-IN')}</td>
                <td className="td text-right">₹{Number(s.cashSales || 0).toLocaleString('en-IN')}</td>
                <td className={cn('td text-right font-mono', Number(s.cashDifference) < 0 ? 'text-red-600 dark:text-red-400' : Number(s.cashDifference) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-400')}>
                  {s.cashDifference !== null ? `${Number(s.cashDifference) > 0 ? '+' : ''}₹${Number(s.cashDifference).toFixed(2)}` : '—'}
                </td>
                <td className="td"><span className={s.status === 'open' ? 'badge-green' : 'badge-slate'}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Open Shift Modal */}
      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Open New Shift</h3>
            <p className="text-sm text-slate-900 dark:text-slate-400">Count the opening cash in the drawer</p>
            <DenominationCount label="Opening Cash" counts={openingCounts} onChange={(k, v) => setOpeningCounts((c) => ({ ...c, [k]: v }))} />
            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => openMutation.mutate()} disabled={openMutation.isPending} className="btn-primary flex-1">
                Open Shift — ₹{openingTotal.toLocaleString('en-IN')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showClose && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Close Shift — {activeShift.shiftNumber}</h3>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-slate-900 dark:text-slate-400">Opening Cash</div><div className="text-slate-900 dark:text-white text-right font-medium">₹{Number(activeShift.openingCash).toLocaleString('en-IN')}</div>
              <div className="text-slate-900 dark:text-slate-400">Cash Sales</div><div className="text-emerald-600 dark:text-emerald-400 text-right font-medium">+₹{Number(activeShift.cashSales).toLocaleString('en-IN')}</div>
              <div className="text-slate-900 dark:text-slate-400">Expected Total</div><div className="text-slate-900 dark:text-white text-right font-bold">₹{(Number(activeShift.openingCash) + Number(activeShift.cashSales)).toLocaleString('en-IN')}</div>
              <div className="text-slate-900 dark:text-slate-400">You're counting</div><div className="text-amber-600 dark:text-amber-400 text-right font-bold">₹{closingTotal.toLocaleString('en-IN')}</div>
              <div className="col-span-2 border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold">
                <span>Difference</span>
                <span className={cn(closingTotal - (Number(activeShift.openingCash) + Number(activeShift.cashSales)) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {closingTotal - (Number(activeShift.openingCash) + Number(activeShift.cashSales)) > 0 ? '+' : ''}
                  ₹{(closingTotal - (Number(activeShift.openingCash) + Number(activeShift.cashSales))).toFixed(2)}
                </span>
              </div>
            </div>
            <DenominationCount label="Closing Cash Count" counts={closingCounts} onChange={(k, v) => setClosingCounts((c) => ({ ...c, [k]: v }))} />
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks for this shift..." /></div>
            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="btn-danger flex-1">
                {closeMutation.isPending ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
