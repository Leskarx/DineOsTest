'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPatch, apiPost } from '@/lib/api';
import toast from 'react-hot-toast';
import { printHtml } from '@/lib/printer';
import { Search, Printer, XCircle, Mail, Truck, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const STATUS_BADGE: Record<string, string> = {
  issued:   'badge-blue',
  paid:     'badge-green',
  void:     'badge-red',
  draft:    'badge-slate',
  refunded: 'badge-yellow',
};

const LIMIT = 15;

/* ── Resolve order type ──────────────────────────────────────────────────── */
function resolveOrderType(bill: any): string {
  return bill?.order?.type ?? bill?.orderType ?? bill?.type ?? 'dine_in';
}

/* ── Order type display ──────────────────────────────────────────────────── */
function orderTypeLabel(type: string): { icon: string; label: string } {
  if (type === 'delivery') return { icon: '🛵', label: 'Delivery' };
  if (type === 'takeaway') return { icon: '🥡', label: 'Takeaway' };
  return { icon: '🍽️', label: 'Dine In' };
}

function OrderTypeChip({ type }: { type: string }) {
  const { icon, label } = orderTypeLabel(type);
  const colorClass =
    type === 'delivery'
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      : type === 'takeaway'
        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
      colorClass,
    )}>
      {icon} {label}
    </span>
  );
}

function CodChip() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
      <Banknote size={9} /> COD
    </span>
  );
}

/* ── COD detection ───────────────────────────────────────────────────────── */
function detectCod(bill: any): boolean {
  if (resolveOrderType(bill) !== 'delivery') return false;
  return (
    bill?.deliveryPaymentType        === 'cod' ||
    bill?.order?.deliveryPaymentType === 'cod' ||
    bill?.payments?.some((p: any) => p.referenceNo === 'cod' || p.method === 'cod')
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function BillingPage() {
  const qc = useQueryClient();

  const [from,         setFrom]         = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to,           setTo]           = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [emailModal,   setEmailModal]   = useState<{ billId: string; billNumber: string } | null>(null);
  const [emailInput,   setEmailInput]   = useState('');

  /* ── Bills list ──────────────────────────────────────────────────────── */
  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills', from, to],
    queryFn: () =>
      apiFetch(
        `/api/v1/billing/bills?source=pos&from=${from}T00:00:00&to=${to}T23:59:59&limit=200`
      ).then((r) => r.data?.data ?? r.data),
    // Reset page when date changes
    select: (data) => data,
  });

  /* ── Bill detail ─────────────────────────────────────────────────────── */
  const { data: billDetail } = useQuery({
    queryKey: ['billDetail', selectedBill?.id],
    queryFn:  () => apiFetch(`/api/v1/billing/bills/${selectedBill?.id}`).then((r) => r.data),
    enabled:  !!selectedBill,
  });

  /* ── Build print args ────────────────────────────────────────────────── */
  const buildPrintArgs = (bd: any) => {
    const orderType  = resolveOrderType(bd);
    const isDelivery = orderType === 'delivery';
    const isCOD      = detectCod(bd);
    return {
      restaurantName:  'Dine&Stay Restaurant',
      billNumber:      bd.billNumber,
      invoiceDate:     dayjs(bd.createdAt).format('D MMM YYYY h:mm A'),
      orderType,
      tableName:       bd.tableName ?? bd.order?.table?.name ?? undefined,
      customerName:    bd.customerName                         ?? undefined,
      customerPhone:   bd.customerPhone ?? bd.order?.customerPhone ?? undefined,
      customerGstin:   bd.customerGstin                        ?? undefined,
      deliveryAddress: isDelivery
        ? (bd.deliveryAddress ?? bd.order?.deliveryAddress ?? undefined)
        : undefined,
      isCOD,
      items: (bd.orderItems ?? []).map((i: any) => ({
        name:   i.name,
        qty:    Number(i.quantity),
        rate:   Number(i.unitPrice),
        amount: Number(i.lineTotal),
      })),
      subtotal:       Number(bd.subtotal),
      discountAmount: Number(bd.discountAmount ?? 0),
      totalTax:       Number(bd.totalTax),
      grandTotal:     Number(bd.grandTotal),
      payments: (bd.payments ?? []).map((p: any) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
      gstSummary: bd.gstSummary ?? [],
    };
  };

  /* ── Mutations ───────────────────────────────────────────────────────── */
  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPatch(`/api/v1/billing/bills/${id}/void`, { reason }),
    onSuccess: () => {
      toast.success('Bill voided');
      qc.invalidateQueries({ queryKey: ['bills'] });
      setSelectedBill(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const reprintMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/billing/bills/${id}/reprint`, {}),
    onSuccess: (data: any) => {
      toast.success('Reprint recorded');
      // reprintBill now returns full bill detail — use it directly for printing
      const printData = data?.data ?? data;
      if (printData) {
        try { printHtml(buildPrintArgs(printData)); }
        catch (err) { console.error('Print failed:', err); toast.error('Print failed'); }
      }
    },
    onError: () => toast.error('Reprint failed'),
  });

  const emailMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      apiPost(`/api/v1/billing/bills/${id}/email`, { email }),
    onSuccess: () => {
      toast.success('Bill emailed successfully');
      setEmailModal(null);
      setEmailInput('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Email failed'),
  });

  /* ── Filter + paginate ───────────────────────────────────────────────── */
  const filtered = (bills ?? []).filter((b: any) =>
    !search ||
    b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages     = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const safePage       = Math.min(page, totalPages);
  const paginated      = filtered.slice((safePage - 1) * LIMIT, safePage * LIMIT);

  const totals = {
    gross: filtered.reduce((s: number, b: any) => s + Number(b.grandTotal), 0),
    tax:   filtered.reduce((s: number, b: any) => s + Number(b.totalTax),   0),
    count: filtered.length,
  };

  /* ── Reset page when search/date changes ─────────────────────────────── */
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFromChange   = (v: string) => { setFrom(v);   setPage(1); };
  const handleToChange     = (v: string) => { setTo(v);     setPage(1); };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full">

      {/* ── Bill List ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Filters bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date" className="input py-1.5"
                value={from} onChange={(e) => handleFromChange(e.target.value)}
              />
              <span className="text-slate-500">to</span>
              <input
                type="date" className="input py-1.5"
                value={to} onChange={(e) => handleToChange(e.target.value)}
              />
            </div>
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-8"
                placeholder="Bill # or customer..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">{totals.count} bills</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              ₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-slate-500">
              GST: ₹{totals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/50 dark:bg-slate-800/50 sticky top-0 z-10">
              <tr>
                <th className="th">Bill #</th>
                <th className="th">Time</th>
                <th className="th">Order Type</th>
                <th className="th">Customer</th>
                <th className="th text-right">Amount</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(LIMIT)].map((_, i) => (
                  <tr key={i} className="table-row">
                    {[...Array(6)].map((__, j) => (
                      <td key={j} className="td">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No bills found for this period
                  </td>
                </tr>
              ) : (
                paginated.map((bill: any) => {
                  const orderType = resolveOrderType(bill);
                  const isCOD     = detectCod(bill);
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => setSelectedBill(bill)}
                      className={cn(
                        'table-row cursor-pointer',
                        selectedBill?.id === bill.id && 'bg-amber-50 dark:bg-amber-500/10',
                      )}
                    >
                      <td className="td font-medium text-amber-600 dark:text-amber-400">
                        {bill.billNumber}
                      </td>
                      <td className="td text-slate-400 text-xs">
                        {dayjs(bill.createdAt).format('h:mm A')}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1 flex-wrap">
                          <OrderTypeChip type={orderType} />
                          {isCOD && <CodChip />}
                        </div>
                      </td>
                      <td className="td">
                        {bill.customerName
                          ? <span className="text-slate-700 dark:text-slate-300">{bill.customerName}</span>
                          : <span className="text-slate-400 dark:text-slate-600">—</span>
                        }
                      </td>
                      <td className="td text-right font-bold">
                        ₹{Number(bill.grandTotal).toFixed(2)}
                      </td>
                      <td className="td">
                        <span className={STATUS_BADGE[bill.status] || 'badge-slate'}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — only shown when more than one page */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
            <span className="text-xs text-slate-500">
              Showing {(safePage - 1) * LIMIT + 1}–{Math.min(safePage * LIMIT, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {safePage} / {totalPages}
              </span>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Email Modal ─────────────────────────────────────────────────── */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-slate-900 dark:text-white">
                Email Bill {emailModal.billNumber}
              </h3>
            </div>
            <div>
              <label className="label">Customer Email</label>
              <input
                className="input" type="email"
                placeholder="customer@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && emailInput &&
                  emailMutation.mutate({ id: emailModal.billId, email: emailInput })
                }
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setEmailModal(null); setEmailInput(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
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

      {/* ── Bill Detail Panel ────────────────────────────────────────────── */}
      {selectedBill && (
        <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 flex flex-col">

          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white truncate">
                {selectedBill.billNumber}
              </h3>
              {billDetail && (() => {
                const ot    = resolveOrderType(billDetail);
                const isCOD = detectCod(billDetail);
                return (
                  <div className="flex items-center gap-1">
                    <OrderTypeChip type={ot} />
                    {isCOD && <CodChip />}
                  </div>
                );
              })()}
            </div>
            <button
              onClick={() => setSelectedBill(null)}
              className="btn-ghost p-1 flex-shrink-0"
            >
              <XCircle size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {billDetail && (() => {
              const orderType       = resolveOrderType(billDetail);
              const isDelivery      = orderType === 'delivery';
              const isCOD           = detectCod(billDetail);
              const deliveryAddress = billDetail.deliveryAddress ?? billDetail.order?.deliveryAddress;
              const customerPhone   = billDetail.customerPhone   ?? billDetail.order?.customerPhone;

              return (
                <>
                  {/* Meta */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Date</span>
                      <span className="text-slate-900 dark:text-white text-right text-xs">
                        {dayjs(billDetail.createdAt).format('D MMM YYYY, h:mm A')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Type</span>
                      <div className="flex items-center gap-1">
                        <OrderTypeChip type={orderType} />
                        {isCOD && <CodChip />}
                      </div>
                    </div>
                    {billDetail.tableName && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Table</span>
                        <span>{billDetail.tableName}</span>
                      </div>
                    )}
                    {billDetail.customerName && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Customer</span>
                        <span>{billDetail.customerName}</span>
                      </div>
                    )}
                    {customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Phone</span>
                        <span>{customerPhone}</span>
                      </div>
                    )}
                    {billDetail.customerGstin && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">GSTIN</span>
                        <span className="font-mono text-xs">{billDetail.customerGstin}</span>
                      </div>
                    )}
                  </div>

                  {/* Delivery box */}
                  {isDelivery && (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Truck size={13} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          Delivery Details
                        </span>
                        {isCOD && (
                          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                            <Banknote size={9} /> COD
                          </span>
                        )}
                      </div>
                      {customerPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">📞</span>
                          <span>{customerPhone}</span>
                        </div>
                      )}
                      {deliveryAddress && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="text-slate-400 mt-0.5">📍</span>
                          <span>{deliveryAddress}</span>
                        </div>
                      )}
                      {isCOD && (
                        <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/50">
                          <div className="flex justify-between text-xs font-semibold text-amber-700 dark:text-amber-300">
                            <span>Rider collects</span>
                            <span>₹{Number(billDetail.grandTotal).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items</div>
                    {(billDetail.orderItems ?? []).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="text-slate-900 dark:text-white font-medium">
                          ₹{Number(item.lineTotal).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span>₹{Number(billDetail.subtotal).toFixed(2)}</span>
                    </div>
                    {Number(billDetail.discountAmount) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount</span>
                        <span>-₹{Number(billDetail.discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>GST</span>
                      <span>₹{Number(billDetail.totalTax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span>Grand Total</span>
                      <span>₹{Number(billDetail.grandTotal).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payments */}
                  {billDetail.payments?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Payment</div>
                      {isCOD ? (
                        <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                            <Banknote size={13} /> Cash on Delivery
                          </span>
                          <span className="font-bold text-amber-700 dark:text-amber-300">
                            ₹{Number(billDetail.grandTotal).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        billDetail.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-sm">
                            <span className="badge-slate capitalize">{p.method}</span>
                            <span>₹{Number(p.amount).toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => reprintMutation.mutate(selectedBill.id)}
                disabled={reprintMutation.isPending}
                className="btn-secondary text-xs"
              >
                <Printer size={13} />
                {reprintMutation.isPending ? 'Printing...' : 'Reprint'}
              </button>
              <button
                onClick={() => {
                  setEmailInput(billDetail?.customerEmail || '');
                  setEmailModal({ billId: selectedBill.id, billNumber: selectedBill.billNumber });
                }}
                className="btn-secondary text-xs"
              >
                <Mail size={13} /> Email
              </button>
            </div>
            {selectedBill.status !== 'void' && (
              <button
                onClick={() => {
                  const r = prompt('Void reason?');
                  if (r) voidMutation.mutate({ id: selectedBill.id, reason: r });
                }}
                className="btn-danger w-full text-sm"
              >
                <XCircle size={14} /> Void Bill
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}