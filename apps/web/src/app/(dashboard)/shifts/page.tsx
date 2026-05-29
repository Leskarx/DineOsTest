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
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [closingCounts, setClosingCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);

  // Get active shift - FIXED: extract the nested data
  const { data: activeShiftResponse } = useQuery({
    queryKey: ['activeShift', branchId],
    queryFn: async () => {
      const response = await apiFetch('/api/v1/shifts/active');
      console.log('ACTIVE API RESPONSE = ', response);
      return response.data; // This returns { success: true, data: {...} }
    },
    enabled: !!branchId,
  });

  // Extract the actual shift data from the response
  const activeShift = activeShiftResponse?.data || null;

  // Get shifts list - FIXED: handle nested data structure
  const { data: shiftsListResponse } = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      const response = await apiFetch('/api/v1/shifts');
      return response.data; // This might be { success: true, data: [...] } or just an array
    },
    enabled: !!branchId,
  });

  // Extract shifts array from response
  const shifts = shiftsListResponse?.data || (Array.isArray(shiftsListResponse) ? shiftsListResponse : []);

  console.log('shiftsList =', shiftsListResponse);
  console.log('activeShift =', activeShift);

  // Get shift summary when selected
  const { data: shiftSummary } = useQuery({
    queryKey: ['shiftSummary', selectedShift?.id],
    queryFn: async () => {
      const response = await apiFetch(`/api/v1/shifts/${selectedShift.id}/summary`);
      return response.data?.data || response.data;
    },
    enabled: !!selectedShift?.id,
  });

  const closingTotal = DENOMS.reduce((s, d) => s + (closingCounts[d.key] || 0) * d.value, 0);

  // Open shift mutation
  const openMutation = useMutation({
    mutationFn: async () => {
      const response = await apiPost('/api/v1/shifts/open', { openingCash });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Shift opened successfully!');
      qc.invalidateQueries({ queryKey: ['activeShift', branchId] });
      qc.invalidateQueries({ queryKey: ['shifts', branchId] });
      setShowOpen(false);
      setOpeningCash(0);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to open shift');
    },
  });

  // Close shift mutation - FIXED: use correct path to id
  const closeMutation = useMutation({
    mutationFn: async () => {
      console.log('activeShift before close = ', activeShift);
      console.log('shiftId = ', activeShift?.id); // Now this should work
      const shiftId = activeShift?.id;
      if (!shiftId) throw new Error('No active shift found');

      const response = await apiPost(`/api/v1/shifts/${shiftId}/close`, {
        closingCash: closingTotal,
        denominations: closingCounts,
        notes: notes || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Shift closed successfully!');
      qc.invalidateQueries({ queryKey: ['activeShift', branchId] });
      qc.invalidateQueries({ queryKey: ['shifts', branchId] });
      setShowClose(false);
      if (data) {
        setSelectedShift(data?.data || data);
      }
      setClosingCounts({});
      setNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to close shift');
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Shift Management</h1>
        {!activeShift ? (
          <button onClick={() => setShowOpen(true)} className="btn-primary">
            <Unlock size={14} /> Open Shift
          </button>
        ) : (
          <button onClick={() => setShowClose(true)} className="btn-danger">
            <Lock size={14} /> Close Shift
          </button>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift && (
        <div className="card border-emerald-800/50 bg-emerald-900/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-bold text-emerald-600 dark:text-emerald-400">
              Active Shift — {activeShift.shiftNumber}
            </h2>
            <span className="text-xs text-slate-900 dark:text-slate-400">
              Since {dayjs(activeShift.openedAt).format('h:mm A')}
            </span>
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

      {/* Shift History Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
          Shift History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100/50 dark:bg-slate-800/50">
              <tr>
                <th className="th">Shift ID</th>
                <th className="th">Opening Cash</th>
                <th className="th">Cash Sales</th>
                <th className="th">Online Sales</th>
                <th className="th">Expected Cash</th>
                <th className="th">Actual Cash</th>
                <th className="th">Difference</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s: any) => {
                const openingCashVal = Number(s.openingCash || 0);
                const cashSalesVal = Number(s.cashSales || 0);
                const onlineSalesVal = Number(s.onlineSales || s.upiSales || 0);
                const expectedCashVal = Number(s.expectedCash || 0);
                const actualCashVal = Number(s.closingCash || 0);
                const differenceVal = Number(s.cashDifference || 0);

                return (
                  <tr
                    key={s.id}
                    className="table-row cursor-pointer"
                    onClick={() => setSelectedShift(s)}
                  >
                    <td className="td font-medium">{s.shiftNumber}</td>
                    <td className="td text-right">₹{openingCashVal.toLocaleString('en-IN')}</td>
                    <td className="td text-right">₹{cashSalesVal.toLocaleString('en-IN')}</td>
                    <td className="td text-right">₹{onlineSalesVal.toLocaleString('en-IN')}</td>
                    <td className="td text-right">₹{expectedCashVal.toLocaleString('en-IN')}</td>
                    <td className="td text-right">₹{actualCashVal.toLocaleString('en-IN')}</td>
                    <td className={cn('td text-right font-mono',
                      differenceVal < 0 ? 'text-red-600 dark:text-red-400' :
                        differenceVal > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                          'text-slate-900 dark:text-slate-400'
                    )}>
                      {differenceVal !== 0 ? `${differenceVal > 0 ? '+' : ''}₹${Math.abs(differenceVal).toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="td">
                      <span className={s.status === 'open' ? 'badge-green' : 'badge-slate'}>
                        {s.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="td text-center text-slate-500">
                    No shifts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Modal */}
      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Open New Shift</h3>
            <p className="text-sm text-slate-900 dark:text-slate-400">
              Enter the opening cash amount in the drawer
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Opening Cash Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={openingCash}
                onChange={(e) => setOpeningCash(Number(e.target.value))}
                className="input w-full text-lg font-semibold"
                placeholder="Enter amount"
                autoFocus
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter the total cash amount in the drawer at shift start
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => openMutation.mutate()}
                disabled={openMutation.isPending || openingCash <= 0}
                className="btn-primary flex-1"
              >
                {openMutation.isPending ? 'Opening...' : `Open Shift — ₹${openingCash.toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showClose && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              Close Shift — {activeShift.shiftNumber}
            </h3>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-slate-900 dark:text-slate-400">Opening Cash</div>
              <div className="text-slate-900 dark:text-white text-right font-medium">
                ₹{Number(activeShift.openingCash || 0).toLocaleString('en-IN')}
              </div>

              <div className="text-slate-900 dark:text-slate-400">Cash Sales</div>
              <div className="text-emerald-600 dark:text-emerald-400 text-right font-medium">
                +₹{Number(activeShift.cashSales || 0).toLocaleString('en-IN')}
              </div>

              <div className="text-slate-900 dark:text-slate-400">Expected Cash</div>
              <div className="text-slate-900 dark:text-white text-right font-bold">
                ₹{(Number(activeShift.openingCash || 0) + Number(activeShift.cashSales || 0)).toLocaleString('en-IN')}
              </div>

              <div className="text-slate-900 dark:text-slate-400">Counted Cash</div>
              <div className="text-amber-600 dark:text-amber-400 text-right font-bold">
                ₹{closingTotal.toLocaleString('en-IN')}
              </div>

              <div className="col-span-2 border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold">
                <span>Difference</span>
                <span className={cn(
                  closingTotal - (Number(activeShift.openingCash || 0) + Number(activeShift.cashSales || 0)) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}>
                  {closingTotal - (Number(activeShift.openingCash || 0) + Number(activeShift.cashSales || 0)) > 0 ? '+' : ''}
                  ₹{(closingTotal - (Number(activeShift.openingCash || 0) + Number(activeShift.cashSales || 0))).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <DenominationCount
              label="Closing Cash Count (Denominations)"
              counts={closingCounts}
              onChange={(k, v) => setClosingCounts((c) => ({ ...c, [k]: v }))}
            />

            <div>
              <label className="label">Notes (Optional)</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any remarks for this shift..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending || closingTotal === 0}
                className="btn-danger flex-1"
              >
                {closeMutation.isPending ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}