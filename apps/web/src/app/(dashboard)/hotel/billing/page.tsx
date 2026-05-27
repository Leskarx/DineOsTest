'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';
import { Receipt, Search, FileText, Printer, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bill {
  id: string;
  billNumber: string;
  customerName: string | null;
  status: string;
  grandTotal: number;
  paidAmount: number;
  createdAt: string;
  notes: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HotelBillingPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: bills = [], isLoading, refetch, isFetching } = useQuery<Bill[]>({
    queryKey: ['hotel-bills', user?.branchId],
    queryFn: async () => {
      const res = await api.get('/api/v1/billing/bills?source=hotel');
      const d = res.data;
      // Handle various response shapes
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d?.data?.data)) return d.data.data;
      return [];
    },
    staleTime: 30_000,
    enabled: !!user?.branchId,
  });

  const filteredBills = (Array.isArray(bills) ? bills : []).filter(b =>
    !search ||
    b.billNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
            <Receipt size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">Hotel Billing</h1>
            <p className="text-xs text-slate-900 dark:text-slate-500">Guest invoices generated at checkout</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-400 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search by invoice # or guest name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-xs pl-8 py-1.5 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-900 dark:text-slate-500 text-sm animate-pulse">Loading…</div>
        ) : filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <FileText size={40} />
            <p className="text-sm">
              {search ? 'No bills match your search' : 'No hotel bills yet — bills are generated at checkout'}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Guest</th>
                <th className="text-left px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Date</th>
                <th className="text-right px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Total</th>
                <th className="text-right px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Balance</th>
                <th className="text-center px-4 py-3 font-medium text-slate-900 dark:text-slate-400">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredBills.map((bill) => {
                const balance = Math.max(0, Number(bill.grandTotal) - Number(bill.paidAmount));
                return (
                  <tr key={bill.id} className="hover:bg-slate-50 dark:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">{bill.billNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{bill.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-400">{fmtDate(bill.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{formatCurrency(Number(bill.grandTotal))}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(bill.paidAmount))}</td>
                    <td className="px-4 py-3 text-right">
                      {balance > 0.01
                        ? <span className="text-red-600 dark:text-red-400">{formatCurrency(balance)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide', {
                        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': bill.status === 'paid',
                        'bg-red-500/15 text-red-600 dark:text-red-400': bill.status === 'void',
                        'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400': bill.status === 'issued' || bill.status === 'draft',
                      })}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-200 dark:bg-slate-700/50 text-slate-900 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-colors"
                        onClick={() => window.open(`/billing/${bill.id}`, '_blank')}
                      >
                        <Printer size={11} /> Print
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
