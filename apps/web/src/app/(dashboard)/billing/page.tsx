'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPatch, apiPost } from '@/lib/api';
import toast from 'react-hot-toast';
import { printHtml } from '@/lib/printer';
import { Search, Printer, XCircle, Mail, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const STATUS_BADGE: Record<string, string> = {
  issued: 'badge-blue', paid: 'badge-green', void: 'badge-red', draft: 'badge-slate', refunded: 'badge-yellow',
};

export default function BillingPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [emailModal, setEmailModal] = useState<{ billId: string; billNumber: string } | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const { data: bills } = useQuery({
    queryKey: ['bills', from, to],
    // listBills now returns { data: Bill[], total, page, limit } — unwrap the inner array
    queryFn: () => apiFetch(`/api/v1/billing/bills?source=pos&from=${from}T00:00:00&to=${to}T23:59:59&limit=200`).then((r) => r.data?.data ?? r.data),
  });

  const { data: billDetail } = useQuery({
    queryKey: ['billDetail', selectedBill?.id],
    queryFn: () => apiFetch(`/api/v1/billing/bills/${selectedBill?.id}`).then((r) => r.data),
    enabled: !!selectedBill,
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiPatch(`/api/v1/billing/bills/${id}/void`, { reason }),
    onSuccess: () => { toast.success('Bill voided'); qc.invalidateQueries({ queryKey: ['bills'] }); setSelectedBill(null); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const reprintMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/billing/bills/${id}/reprint`, {}),
    onSuccess: (_, id) => {
      toast.success('Reprint recorded');
      qc.invalidateQueries({ queryKey: ['billDetail', id] });
      // Also trigger browser print
      if (billDetail) {
        printHtml({
          restaurantName: 'Dine&Stay Restaurant',
          billNumber: billDetail.billNumber,
          invoiceDate: dayjs(billDetail.createdAt).format('D MMM YYYY h:mm A'),
          orderType: 'dine_in',
          items: billDetail.orderItems?.map((i: any) => ({ name: i.name, qty: i.quantity, rate: i.unitPrice, amount: i.lineTotal })) || [],
          subtotal: Number(billDetail.subtotal),
          totalTax: Number(billDetail.totalTax),
          grandTotal: Number(billDetail.grandTotal),
          payments: billDetail.payments?.map((p: any) => ({ method: p.method, amount: Number(p.amount) })) || [],
          gstSummary: billDetail.gstSummary,
        });
      }
    },
    onError: () => toast.error('Reprint failed'),
  });

  const emailMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => apiPost(`/api/v1/billing/bills/${id}/email`, { email }),
    onSuccess: () => { toast.success('Bill emailed successfully'); setEmailModal(null); setEmailInput(''); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Email failed'),
  });

  const filtered = bills?.filter((b: any) => !search || b.billNumber.includes(search) || b.customerName?.toLowerCase().includes(search.toLowerCase())) ?? [];

  const totals = { gross: filtered.reduce((s: number, b: any) => s + Number(b.grandTotal), 0), tax: filtered.reduce((s: number, b: any) => s + Number(b.totalTax), 0), count: filtered.length };

  return (
    <div className="flex h-full">
      {/* Bill List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <input type="date" className="input py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-500">to</span>
              <input type="date" className="input py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8" placeholder="Bill # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-400">{totals.count} bills</span>
            <span className="text-amber-400 font-medium">₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-500">GST: ₹{totals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 sticky top-0 z-10"><tr><th className="th">Bill #</th><th className="th">Time</th><th className="th">Customer</th><th className="th text-right">Amount</th><th className="th">Status</th></tr></thead>
            <tbody>
              {filtered.map((bill: any) => (
                <tr key={bill.id} onClick={() => setSelectedBill(bill)} className={cn('table-row cursor-pointer', selectedBill?.id === bill.id && 'bg-amber-500/10')}>
                  <td className="td font-medium text-amber-400">{bill.billNumber}</td>
                  <td className="td text-slate-400 text-xs">{dayjs(bill.createdAt).format('h:mm A')}</td>
                  <td className="td">{bill.customerName || <span className="text-slate-500 italic">Walk-in</span>}</td>
                  <td className="td text-right font-bold">₹{Number(bill.grandTotal).toFixed(2)}</td>
                  <td className="td"><span className={STATUS_BADGE[bill.status] || 'badge-slate'}>{bill.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-slate-500">No bills found for this period</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-amber-400" />
              <h3 className="font-bold text-white">Email Bill {emailModal.billNumber}</h3>
            </div>
            <div>
              <label className="label">Customer Email</label>
              <input
                className="input"
                type="email"
                placeholder="customer@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && emailInput && emailMutation.mutate({ id: emailModal.billId, email: emailInput })}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setEmailModal(null); setEmailInput(''); }} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => emailMutation.mutate({ id: emailModal.billId, email: emailInput })}
                disabled={emailMutation.isPending || !emailInput}
                className="btn-primary flex-1"
              >
                {emailMutation.isPending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail */}
      {selectedBill && (
        <div className="w-80 flex-shrink-0 border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white">{selectedBill.billNumber}</h3>
            <button onClick={() => setSelectedBill(null)} className="btn-ghost p-1"><XCircle size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {billDetail && (
              <>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Date</span><span>{dayjs(billDetail.createdAt).format('D MMM YYYY, h:mm A')}</span></div>
                  {billDetail.customerName && <div className="flex justify-between"><span className="text-slate-400">Customer</span><span>{billDetail.customerName}</span></div>}
                  {billDetail.customerGstin && <div className="flex justify-between"><span className="text-slate-400">GSTIN</span><span className="font-mono text-xs">{billDetail.customerGstin}</span></div>}
                </div>

                <div className="space-y-1">
                  {billDetail.orderItems?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.quantity}× {item.name}</span>
                      <span className="text-white font-medium">₹{Number(item.lineTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>₹{Number(billDetail.subtotal).toFixed(2)}</span></div>
                  {Number(billDetail.discountAmount) > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-₹{Number(billDetail.discountAmount).toFixed(2)}</span></div>}
                  <div className="flex justify-between text-slate-400"><span>GST</span><span>₹{Number(billDetail.totalTax).toFixed(2)}</span></div>
                  <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2"><span>Grand Total</span><span>₹{Number(billDetail.grandTotal).toFixed(2)}</span></div>
                </div>

                {billDetail.payments?.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Payments</div>
                    {billDetail.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="badge-slate capitalize">{p.method}</span>
                        <span>₹{Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-4 border-t border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => reprintMutation.mutate(selectedBill.id)}
                disabled={reprintMutation.isPending}
                className="btn-secondary text-xs"
              >
                <Printer size={13} /> Reprint
              </button>
              <button
                onClick={() => { setEmailInput(billDetail?.customerEmail || ''); setEmailModal({ billId: selectedBill.id, billNumber: selectedBill.billNumber }); }}
                className="btn-secondary text-xs"
              >
                <Mail size={13} /> Email
              </button>
            </div>
            {selectedBill.status !== 'void' && (
              <button onClick={() => { const r = prompt('Void reason?'); if (r) voidMutation.mutate({ id: selectedBill.id, reason: r }); }} className="btn-danger w-full text-sm">
                <XCircle size={14} /> Void Bill
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
