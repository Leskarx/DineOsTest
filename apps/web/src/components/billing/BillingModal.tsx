'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiPost, apiPatch, apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { usePosStore } from '@/store/pos.store';
import { printHtml } from '@/lib/printer';
import { amountInWords } from '@/lib/gst';
import { X, Printer, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';

const PAYMENT_METHODS: { id: PayMethod; label: string; icon: string }[] = [
  { id: 'cash',          label: 'Cash',   icon: '💵' },
  { id: 'upi',           label: 'UPI',    icon: '📱' },
  { id: 'card',          label: 'Card',   icon: '💳' },
  { id: 'wallet',        label: 'Wallet', icon: '👛' },
  { id: 'credit',        label: 'Credit', icon: '📋' },
  { id: 'complimentary', label: 'Comp',   icon: '🎁' },
];

// ← Round to 2 decimal places safely
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface Props {
  shiftId?: string | null;
  grandTotal: number;
  subtotal: number;
  gstTotal: number;
  orderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BillingModal({
  shiftId, grandTotal: rawGrandTotal, subtotal: rawSubtotal, gstTotal: rawGstTotal,
  orderId, onClose, onSuccess,
}: Props) {
  const { branchId, tenantId } = useAuthStore();
  const { cart, orderType, tableId, tableName, discountAmount, discountPercent } = usePosStore();

  // ← Round all incoming values
  const grandTotal = round2(rawGrandTotal);
  const subtotal   = round2(rawSubtotal);
  const gstTotal   = round2(rawGstTotal);

  const [method, setMethod]               = useState<PayMethod>('cash');
  const [cashEntered, setCashEntered]     = useState(Math.ceil(grandTotal).toString());
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PayMethod; amount: number }>>([]);
  const [isSplit, setIsSplit]             = useState(false);
  const [billed, setBilled]               = useState(false);
  const [billData, setBillData]           = useState<any>(null);

  // ← This will be updated to server total after order creation
  const [finalTotal, setFinalTotal]       = useState(grandTotal);
  // ← Track if user manually edited the charge amount
  const [manualOverride, setManualOverride] = useState(false);

  const cashAmount = parseFloat(cashEntered) || 0;
  const change     = round2(cashAmount - finalTotal);

  const billMutation = useMutation({
    mutationFn: async () => {
      let oid = orderId;

      // 1. Create order if none exists
      if (!oid) {
        const orderRes = await apiPost('/api/v1/orders', {
          type: orderType,
          tableId,
          items: cart.map((i: any) => ({
            menuItemId: i.id,
            quantity: i.qty,
            notes: i.notes,
            variationId: i.variationId ?? undefined,
          })),
        });
        oid = orderRes.data.id;
      }

      // 2. Apply discount and wait for server to recalculate
      if ((discountPercent > 0 || discountAmount > 0) && oid) {
        await apiPatch(`/api/v1/orders/${oid}/discount`, {
          discountPercent,
          discountAmount,
        });
      }

      // 3. Fetch the server-confirmed total AFTER order+discount
      const orderRes = await apiFetch(`/api/v1/orders/${oid}`);
      const serverTotal = round2(Number(orderRes.data.grandTotal));

      // 4. Determine the bill amount
      //    If cashier manually overrode the amount, respect that
      //    Otherwise use the server-calculated total
      const billAmount = manualOverride ? finalTotal : serverTotal;

      // Update displayed total to match what we're actually billing
      setFinalTotal(billAmount);

      // 5. Build payments using the bill amount
      const paymentAmount = method === 'cash'
        ? Math.max(cashAmount, billAmount)  // cash must cover at least the bill
        : billAmount;

      const payments = isSplit
        ? splitPayments
        : [{ method, amount: round2(paymentAmount) }];

      // 6. Create bill
      const res = await apiPost('/api/v1/billing/bills', {
        orderId: oid,
        branchId,
        tenantId,
        shiftId: shiftId || undefined,
        customerName:  customerName  || undefined,
        customerPhone: customerPhone || undefined,
        customerGstin: customerGstin || undefined,
        payments,
      });

      return { ...res.data, serverTotal };
    },
    onSuccess: (data) => {
      setBillData(data);
      setFinalTotal(data.serverTotal);
      setBilled(true);
      toast.success('Bill created successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Billing failed';
      toast.error(msg);
    },
  });

  const handlePrint = () => {
    if (!billData) return;
    try {
      printHtml({
        restaurantName: 'Dine&Stay Restaurant',
        billNumber:     billData.billNumber,
        invoiceDate:    new Date().toLocaleString('en-IN'),
        tableName:      tableName || undefined,
        orderType,
        customerName:   customerName || undefined,
        customerGstin:  customerGstin || undefined,
        items: cart.map((i: any) => ({
          name:   i.name,
          qty:    i.qty,
          rate:   i.price,
          amount: round2(i.price * i.qty),
        })),
        subtotal,
        discountAmount: round2(discountAmount),
        totalTax:   gstTotal,
        grandTotal: finalTotal,
        payments: isSplit
          ? splitPayments
          : [{ method, amount: method === 'cash' ? cashAmount : finalTotal }],
        changeAmount: method === 'cash' && !isSplit ? Math.max(0, change) : 0,
        gstSummary:  billData.gstSummary,
      });
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Print failed. Check browser console.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">
            {billed ? 'Bill Generated ✓' : 'Generate Bill'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {billed ? (
            /* ── Success ── */
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={48} className="text-emerald-400" />
                <div className="text-center">
                  <div className="text-white font-bold text-xl">₹{finalTotal.toFixed(2)}</div>
                  <div className="text-slate-400 text-sm">Bill #{billData?.billNumber}</div>
                  {method === 'cash' && change > 0 && (
                    <div className="mt-2 text-amber-400 font-semibold text-lg">
                      Change: ₹{change.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 text-center">
                  {amountInWords(finalTotal)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handlePrint} className="btn-secondary">
                  <Printer size={14} /> Print Receipt
                </button>
                <button onClick={onSuccess} className="btn-primary">Done</button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <div className="p-6 space-y-5">

              {/* Summary */}
              <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-₹{round2(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2">
                  <span>Grand Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
                {manualOverride && Math.abs(finalTotal - grandTotal) > 0.01 && (
                  <div className="flex justify-between text-amber-400 text-xs">
                    <span>Adjusted Total</span>
                    <span>₹{finalTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Charge amount */}
              <div>
                <label className="label">
                  Charge Amount
                  <span className="text-slate-500 font-normal ml-1">(edit if needed)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    className="input pl-7 text-lg font-bold"
                    type="number"
                    min={0}
                    step={0.01}
                    value={round2(finalTotal)}
                    onChange={(e) => {
                      const val = round2(parseFloat(e.target.value) || 0);
                      setFinalTotal(val);
                      setManualOverride(true);
                      setCashEntered(Math.ceil(val).toString());
                    }}
                  />
                </div>
                {manualOverride && Math.abs(finalTotal - grandTotal) > 0.01 && (
                  <button
                    className="text-xs text-slate-500 hover:text-slate-300 mt-1"
                    onClick={() => {
                      setFinalTotal(grandTotal);
                      setManualOverride(false);
                      setCashEntered(Math.ceil(grandTotal).toString());
                    }}
                  >
                    Reset to ₹{grandTotal.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Customer Name</label>
                  <input className="input" placeholder="Optional"
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="Optional"
                    value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Customer GSTIN (for B2B)</label>
                  <input className="input" placeholder="Optional — triggers IGST"
                    value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} />
                </div>
              </div>

              {/* Payment method */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Payment Method</label>
                  <button onClick={() => setIsSplit(!isSplit)}
                    className={cn('text-xs px-2 py-1 rounded',
                      isSplit ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white')}>
                    Split Payment
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border',
                        method === m.id && !isSplit
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600',
                      )}>
                      <span className="text-lg">{m.icon}</span>{m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash tendered */}
              {method === 'cash' && !isSplit && (
                <div>
                  <label className="label">Cash Tendered</label>
                  <input className="input text-lg font-bold" type="number"
                    value={cashEntered} onChange={(e) => setCashEntered(e.target.value)} />
                  {change >= 0
                    ? <div className="mt-1 text-sm text-amber-400">Change: ₹{change.toFixed(2)}</div>
                    : <div className="mt-1 text-sm text-red-400">Short by ₹{Math.abs(change).toFixed(2)}</div>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[finalTotal,
                      Math.ceil(finalTotal / 10) * 10,
                      Math.ceil(finalTotal / 50) * 50,
                      Math.ceil(finalTotal / 100) * 100,
                      Math.ceil(finalTotal / 500) * 500,
                    ].filter((v, i, arr) => arr.indexOf(v) === i).map((amt) => (
                      <button key={amt} onClick={() => setCashEntered(amt.toString())}
                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed footer */}
        {!billed && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-800 flex-shrink-0">
            <button
              onClick={() => billMutation.mutate()}
              disabled={
                billMutation.isPending ||
                (method === 'cash' && !isSplit && cashAmount < finalTotal)
              }
              className="btn-primary w-full py-3 text-base"
            >
              {billMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" /> Processing...</>
                : `Collect ₹${finalTotal.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}