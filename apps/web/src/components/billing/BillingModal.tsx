'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiPost, apiPatch } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { usePosStore } from '@/store/pos.store';
import { printHtml } from '@/lib/printer';
import { amountInWords } from '@/lib/gst';
import { X, Printer, CheckCircle, IndianRupee, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';

const PAYMENT_METHODS: { id: PayMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'upi', label: 'UPI', icon: '📱' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'wallet', label: 'Wallet', icon: '👛' },
  { id: 'credit', label: 'Credit', icon: '📋' },
  { id: 'complimentary', label: 'Comp', icon: '🎁' },
];

interface Props {
  grandTotal: number;
  subtotal: number;
  gstTotal: number;
  orderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BillingModal({ grandTotal, subtotal, gstTotal, orderId, onClose, onSuccess }: Props) {
  const { branchId, tenantId } = useAuthStore();
  const { cart, orderType, tableId, tableName, discountAmount, discountPercent } = usePosStore();

  const [method, setMethod] = useState<PayMethod>('cash');
  const [cashEntered, setCashEntered] = useState(Math.ceil(grandTotal).toString());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PayMethod; amount: number }>>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [billed, setBilled] = useState(false);
  const [billData, setBillData] = useState<any>(null);

  const cashAmount = parseFloat(cashEntered) || 0;
  const change = cashAmount - grandTotal;

  const billMutation = useMutation({
    mutationFn: async () => {
      // 1. If no orderId, create order first
      let oid = orderId;
      if (!oid) {
        const orderRes = await apiPost('/api/v1/orders', {
          type: orderType,
          tableId,
          items: cart.map((i: any) => ({ menuItemId: i.id, quantity: i.qty, notes: i.notes })),
        });
        oid = orderRes.data.id;
      }

      // 2. Apply discount to order if any is set in the POS store.
      //    Without this step, order.discountAmount stays 0 in the DB even
      //    though the cashier set a discount — the bill would be over-charged.
      if ((discountPercent > 0 || discountAmount > 0) && oid) {
        await apiPatch(`/api/v1/orders/${oid}/discount`, { discountPercent, discountAmount });
      }

      // 3. Create bill
      const payments = isSplit
        ? splitPayments
        : [{ method, amount: method === 'cash' ? cashAmount : grandTotal }];

      const res = await apiPost('/api/v1/billing/bills', {
        orderId: oid,
        branchId,
        tenantId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerGstin: customerGstin || undefined,
        payments,
      });

      return res.data;
    },
    onSuccess: (data) => {
      setBillData(data);
      setBilled(true);
      toast.success('Bill created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Billing failed');
    },
  });

  const handlePrint = () => {
    if (!billData) return;
    printHtml({
      restaurantName: 'Dine&Stay Restaurant',
      billNumber: billData.billNumber,
      invoiceDate: new Date().toLocaleString('en-IN'),
      tableName: tableName || undefined,
      orderType,
      customerName: customerName || undefined,
      customerGstin: customerGstin || undefined,
      items: cart.map((i: any) => ({
        name: i.name,
        qty: i.qty,
        rate: i.price,
        amount: i.price * i.qty,
      })),
      subtotal,
      discountAmount,
      totalTax: gstTotal,
      grandTotal,
      payments: isSplit ? splitPayments : [{ method, amount: method === 'cash' ? cashAmount : grandTotal }],
      changeAmount: method === 'cash' && !isSplit ? Math.max(0, change) : 0,
      gstSummary: billData.gstSummary,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">{billed ? 'Bill Generated ✓' : 'Generate Bill'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {billed ? (
          /* Success state */
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={48} className="text-emerald-400" />
              <div className="text-center">
                <div className="text-white font-bold text-xl">₹{grandTotal.toFixed(2)}</div>
                <div className="text-slate-400 text-sm">Bill #{billData?.billNumber}</div>
                {method === 'cash' && change > 0 && (
                  <div className="mt-2 text-amber-400 font-semibold text-lg">
                    Change: ₹{change.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500 text-center">
                {amountInWords(grandTotal)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePrint} className="btn-secondary"><Printer size={14} /> Print Receipt</button>
              <button onClick={onSuccess} className="btn-primary">Done</button>
            </div>
          </div>
        ) : (
          /* Billing form */
          <div className="p-6 space-y-5">
            {/* Bill summary */}
            <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-slate-400"><span>GST</span><span>₹{gstTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2">
                <span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Customer info (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Customer Name</label><input className="input" placeholder="Optional" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" placeholder="Optional" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Customer GSTIN (for B2B)</label><input className="input" placeholder="Optional — triggers IGST" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} /></div>
            </div>

            {/* Payment Method */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Payment Method</label>
                <button onClick={() => setIsSplit(!isSplit)} className={cn('text-xs px-2 py-1 rounded', isSplit ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white')}>
                  Split Payment
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    className={cn('flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border', method === m.id && !isSplit ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600')}>
                    <span className="text-lg">{m.icon}</span>{m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash tendered */}
            {method === 'cash' && !isSplit && (
              <div>
                <label className="label">Cash Tendered</label>
                <input className="input text-lg font-bold" type="number" value={cashEntered} onChange={(e) => setCashEntered(e.target.value)} />
                {change >= 0 && <div className="mt-1 text-sm text-amber-400">Change: ₹{change.toFixed(2)}</div>}
                {change < 0 && <div className="mt-1 text-sm text-red-400">Short by ₹{Math.abs(change).toFixed(2)}</div>}
                {/* Quick cash buttons */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[grandTotal, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500].filter((v, i, arr) => arr.indexOf(v) === i).map((amt) => (
                    <button key={amt} onClick={() => setCashEntered(amt.toString())} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">₹{amt}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => billMutation.mutate()} disabled={billMutation.isPending || (method === 'cash' && !isSplit && cashAmount < grandTotal)} className="btn-primary w-full py-3 text-base">
              <IndianRupee size={16} /> {billMutation.isPending ? 'Processing...' : `Collect ₹${grandTotal.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
