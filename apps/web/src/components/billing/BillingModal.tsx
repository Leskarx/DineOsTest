'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiPost, apiPatch, apiFetch, api } from '@/lib/api';
import { enqueueSync, getResolvedId, getPendingSyncItems } from '@/lib/offline';
import { useAuthStore } from '@/store/auth.store';
import { usePosStore } from '@/store/pos.store';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { printHtml } from '@/lib/printer';
import { amountInWords } from '@/lib/gst';
import {
  X, Printer, CheckCircle, Loader2, Mail, WifiOff,
  MapPin, Phone, Truck, Banknote, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';

const RAZORPAY_METHODS: PayMethod[] = ['upi', 'card', 'credit'];

const PAYMENT_METHODS: { id: PayMethod; label: string; icon: string }[] = [
  { id: 'cash',          label: 'Cash',   icon: '💵' },
  { id: 'upi',           label: 'UPI',    icon: '📱' },
  { id: 'card',          label: 'Card',   icon: '💳' },
  { id: 'wallet',        label: 'Wallet', icon: '👛' },
  { id: 'credit',        label: 'Credit', icon: '📋' },
  { id: 'complimentary', label: 'Comp',   icon: '🎁' },
];

// For COD delivery — what method will rider collect
const COD_METHODS: { id: PayMethod; label: string; icon: string; desc: string }[] = [
  { id: 'cash',   label: 'Cash',    icon: '💵', desc: 'Rider collects cash at door' },
  { id: 'upi',    label: 'UPI',     icon: '📱', desc: 'Customer pays via UPI to rider' },
  { id: 'wallet', label: 'Wallet',  icon: '👛', desc: 'Digital wallet' },
];

function round2(n: number): number {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}
function nearestRupee(n: number): number {
  return Math.round(round2(n));
}
function formatInputAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface Props {
  shiftId?:    string | null;
  grandTotal:  number;
  subtotal:    number;
  gstTotal:    number;
  orderId:     string | null;
  onClose:     () => void;
  onSuccess:   () => void;
}

export function BillingModal({
  shiftId,
  grandTotal: rawGrandTotal,
  subtotal:   rawSubtotal,
  gstTotal:   rawGstTotal,
  orderId,
  onClose,
  onSuccess,
}: Props) {
  const { branchId, tenantId } = useAuthStore();
  const {
    cart, orderType, tableId, tableName,
    discountAmount, discountPercent,
    // Delivery fields from store — already filled in POS, survive navigation
    deliveryPhone, deliveryName, deliveryAddress, deliveryPaymentType,
    setDeliveryPhone, setDeliveryName, setDeliveryAddress, setDeliveryPaymentType,
  } = usePosStore();

  const isOnline   = useOnlineStatus();
  const isDelivery = orderType === 'delivery';
  const isTakeaway = orderType === 'takeaway';
  const isCOD      = isDelivery && deliveryPaymentType === 'cod';

  const exactGrandTotal = round2(rawGrandTotal);
  const subtotal        = round2(rawSubtotal);
  const gstTotal        = round2(rawGstTotal);
  const defaultPayable  = nearestRupee(exactGrandTotal);
  const defaultRoundOff = round2(defaultPayable - exactGrandTotal);

  // For COD: default collection method is cash (rider collects at door)
  // For prepaid delivery / dine-in / takeaway: normal payment flow
  const [method,        setMethod]        = useState<PayMethod>(isCOD ? 'cash' : 'cash');
  const [customerGstin, setCustomerGstin] = useState('');
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PayMethod; amount: number }>>([]);
  const [isSplit,       setIsSplit]        = useState(false);
  const [billed,        setBilled]         = useState(false);
  const [billData,      setBillData]       = useState<any>(null);
  const [customerEmail, setCustomerEmail]  = useState('');
  const [isRazorpayPending, setIsRazorpayPending] = useState(false);
  const [finalTotal,    setFinalTotal]     = useState<number>(defaultPayable);
  const [manualOverride,setManualOverride] = useState(false);
  const [cashEntered,   setCashEntered]    = useState<string>(formatInputAmount(defaultPayable));

  const cashAmount = round2(parseFloat(cashEntered) || 0);
  const change     = round2(cashAmount - finalTotal);

  const isRazorpayMethod = RAZORPAY_METHODS.includes(method) && !isSplit && !isCOD;

  const handleMethodSelect = (m: PayMethod) => {
    if (!isOnline && RAZORPAY_METHODS.includes(m)) {
      toast.error(`${m.toUpperCase()} requires internet. Use Cash when offline.`);
      return;
    }
    setMethod(m);
  };

  /* ── Delivery validation ─────────────────────────────────────────────── */
  const validateDelivery = (): boolean => {
    if (!isDelivery) return true;
    if (!deliveryPhone.trim()) {
      toast.error('Customer phone is required for delivery');
      return false;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Delivery address is required');
      return false;
    }
    return true;
  };

  /* ── Core bill creation ──────────────────────────────────────────────── */
  const createBillCore = async (razorpayPaymentId?: string) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    let oid = orderId;

    if (oid?.startsWith('OFFLINE-')) {
      const resolved = await getResolvedId(oid);
      if (resolved) oid = resolved;
    }

    if (!oid) {
      const payload = {
        type:            orderType,
        tableId,
        items: cart.map((i: any) => ({
          menuItemId:  i.id,
          quantity:    i.qty,
          notes:       i.notes,
          variationId: i.variationId ?? undefined,
        })),
        customerName:    deliveryName    || undefined,
        customerPhone:   deliveryPhone   || undefined,
        deliveryAddress: deliveryAddress || undefined,
      };

      if (isOffline) {
        oid = `OFFLINE-${Date.now()}`;
        await enqueueSync({
          entityType: 'orders', entityId: oid, operation: 'create',
          payload: { ...payload, isOfflineSync: true, offlineId: oid },
          branchId: branchId || '', tenantId: tenantId || '',
        });
      } else {
        const orderRes = await apiPost('/api/v1/orders', payload);
        oid = orderRes.data.id;
      }
    }

    if ((discountPercent > 0 || discountAmount > 0) && oid) {
      const dp = { discountPercent, discountAmount };
      if (isOffline) {
        await enqueueSync({
          entityType: `orders/${oid}/discount`, entityId: '', operation: 'update',
          payload: { ...dp, _isDiscount: true },
          branchId: branchId || '', tenantId: tenantId || '',
        });
      } else {
        await apiPatch(`/api/v1/orders/${oid}/discount`, dp);
      }
    }

    let serverGrandTotal = defaultPayable;
    if (!isOffline && oid && !oid.startsWith('OFFLINE-')) {
      try {
        const orderRes = await apiFetch(`/api/v1/orders/${oid}`);
        serverGrandTotal = round2(Number(orderRes.data.grandTotal));
      } catch { /* fallback */ }
    }

    const billAmount = manualOverride ? round2(finalTotal) : serverGrandTotal;
    setFinalTotal(billAmount);
    if (!manualOverride && method === 'cash') {
      setCashEntered(formatInputAmount(billAmount));
    }

    // For COD: record as pending collection
    // payment.referenceNo = 'cod' signals backend this will be collected on delivery
    const payments = isSplit
      ? splitPayments
      : isCOD
        ? [{ method, amount: billAmount, referenceNo: 'cod' }]
        : [{
            method,
            amount: method === 'cash' ? round2(parseFloat(cashEntered) || 0) : billAmount,
            ...(razorpayPaymentId ? { referenceNo: razorpayPaymentId } : {}),
          }];

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    // For COD — don't validate cash collected (it's not collected yet)
    if (!isCOD && totalPaid < billAmount - 0.01) {
      throw new Error(
        `Payment ₹${round2(totalPaid).toFixed(2)} is less than bill ₹${billAmount.toFixed(2)}.`
      );
    }

    const billPayload = {
      orderId:       oid, branchId, tenantId,
      shiftId:       shiftId       || undefined,
      customerName:  deliveryName  || undefined,
      customerPhone: deliveryPhone || undefined,
      customerGstin: customerGstin || undefined,
      deliveryAddress: isDelivery ? (deliveryAddress || undefined) : undefined,
      deliveryPaymentType: isDelivery ? deliveryPaymentType : undefined,
      payments,
    };

    if (isOffline) {
      const unsentItems = cart.filter((i: any) => !i.alreadySent);
      if (unsentItems.length > 0 && oid) {
        await enqueueSync({
          entityType: `orders/${oid}/items`, entityId: '', operation: 'create',
          payload: {
            items: unsentItems.map((i: any) => ({
              menuItemId: i.id, quantity: i.qty,
              notes: i.notes || undefined, variationId: i.variationId || undefined,
            })),
            isOfflineSync: true,
          },
          branchId: branchId || '', tenantId: tenantId || '',
        });
      }

      if (oid!.startsWith('OFFLINE-')) {
        const queue = await getPendingSyncItems();
        const orderExists = queue.some(
          (q) => q.entityId === oid && q.entityType === 'orders' && q.operation === 'create'
        );
        if (!orderExists) {
          throw new Error('Order already synced but bill link is missing. Refresh and retry.');
        }
      }

      await enqueueSync({
        entityType: 'billing/bills', entityId: oid!, operation: 'create',
        payload: { ...billPayload, isOfflineSync: true },
        branchId: branchId || '', tenantId: tenantId || '',
      });

      return {
        id: oid!,
        billNumber: `OFF-${Math.floor(Math.random() * 10000)}`,
        serverGrandTotal: billAmount,
        gstSummary: [],
      };
    }

    const res = await apiPost('/api/v1/billing/bills', billPayload);
    return { ...res.data, serverGrandTotal: billAmount };
  };

  const billMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      if (!validateDelivery()) throw new Error('Validation failed');

      // COD — no payment gateway needed, bill immediately
      if (isCOD) return createBillCore();

      if (isRazorpayMethod && isOnline) {
        return new Promise<any>((resolve, reject) => {
          setIsRazorpayPending(true);
          api.post('/api/v1/billing/razorpay/create-order', { amount: finalTotal })
            .then((res) => {
              const order = res.data?.data || res.data;
              const options = {
                key:         order.keyId,
                amount:      order.amount,
                currency:    order.currency,
                name:        'Bill Payment',
                description: 'POS Bill',
                order_id:    order.orderId,
                handler: async (response: any) => {
                  try {
                    await api.post('/api/v1/billing/razorpay/verify-payment', {
                      razorpayOrderId:   response.razorpay_order_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature,
                    });
                    const bill = await createBillCore(response.razorpay_payment_id);
                    resolve(bill);
                  } catch (e) {
                    reject(e);
                  } finally {
                    setIsRazorpayPending(false);
                  }
                },
                modal: {
                  ondismiss: () => {
                    setIsRazorpayPending(false);
                    reject(new Error('Payment was cancelled.'));
                  },
                },
                theme: { color: '#f59e0b' },
              };
              const rzp = new (window as any).Razorpay(options);
              rzp.on('payment.failed', (r: any) => {
                setIsRazorpayPending(false);
                reject(new Error(r.error?.description || 'Payment failed'));
              });
              rzp.open();
            })
            .catch((e) => { setIsRazorpayPending(false); reject(e); });
        });
      }

      return createBillCore();
    },
    onSuccess: (data) => {
      setBillData(data);
      setFinalTotal(round2(data.serverGrandTotal));
      setBilled(true);
      toast.success(
        isCOD
          ? 'Order confirmed! Rider will collect payment on delivery. 🛵'
          : 'Bill created successfully!'
      );

      if (customerEmail.trim() && data?.id) {
        apiPost(`/api/v1/billing/bills/${data.id}/email`, { email: customerEmail.trim() })
          .then(() => toast.success('Receipt emailed!'))
          .catch(() => toast.error('Could not send email receipt.'));
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Billing failed';
      if (msg !== 'Validation failed') toast.error(msg);
    },
  });

  const handlePrint = () => {
    if (!billData) return;
    try {
      printHtml({
        restaurantName:  'Dine&Stay Restaurant',
        billNumber:      billData.billNumber,
        invoiceDate:     new Date().toLocaleString('en-IN'),
        tableName:       tableName  || undefined,
        orderType,
        customerName:    deliveryName    || undefined,
        customerPhone:   deliveryPhone   || undefined,
        customerGstin:   customerGstin   || undefined,
        deliveryAddress: isDelivery ? (deliveryAddress || undefined) : undefined,
        items: cart.map((i: any) => ({
          name:   i.name,
          qty:    i.qty,
          rate:   round2(i.price),
          amount: round2(i.price * i.qty),
        })),
        subtotal,
        discountAmount: round2(discountAmount),
        totalTax:       gstTotal,
        grandTotal:     round2(finalTotal),
        payments: isSplit
          ? splitPayments
          : [{ method, amount: isCOD ? round2(finalTotal) : (method === 'cash' ? cashAmount : round2(finalTotal)) }],
        changeAmount: method === 'cash' && !isSplit && !isCOD ? Math.max(0, round2(change)) : 0,
        gstSummary:   billData.gstSummary,
        isCOD,
      });
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Print failed.');
    }
  };

  const isPending = billMutation.isPending || isRazorpayPending;

  /* ── Delivery info completeness for button enable ────────────────────── */
  const deliveryInfoComplete = !isDelivery || (deliveryPhone.trim() !== '' && deliveryAddress.trim() !== '');

  /* ── Can proceed with payment ────────────────────────────────────────── */
  const canProceed =
    !isPending &&
    deliveryInfoComplete &&
    (isCOD
      ? true  // COD — no cash amount check needed
      : isRazorpayMethod && isOnline
        ? true
        : !isOnline && RAZORPAY_METHODS.includes(method) && !isSplit
          ? false
          : method === 'cash' && !isSplit
            ? cashAmount >= finalTotal
            : true
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isDelivery && <Truck size={18} className="text-amber-500" />}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {billed
                ? 'Order Confirmed ✓'
                : isDelivery
                  ? isCOD ? 'Delivery — COD' : 'Delivery — Prepaid'
                  : isTakeaway
                    ? 'Takeaway Bill'
                    : 'Generate Bill'
              }
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {billed ? (
            /* ── Success screen ── */
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={48} className="text-emerald-600 dark:text-emerald-400" />
                <div className="text-center">
                  <div className="text-slate-900 dark:text-white font-bold text-xl">
                    ₹{round2(finalTotal).toFixed(2)}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm">
                    Bill #{billData?.billNumber}
                  </div>
                  {isCOD && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800">
                      <Banknote size={13} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        COD — Rider collects on delivery
                      </span>
                    </div>
                  )}
                  {!isCOD && method === 'cash' && change > 0 && (
                    <div className="mt-2 text-amber-600 dark:text-amber-400 font-semibold text-lg">
                      Change: ₹{round2(change).toFixed(2)}
                    </div>
                  )}
                  {isDelivery && deliveryPhone && (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      📞 {deliveryPhone}
                    </div>
                  )}
                  {isDelivery && deliveryAddress && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      📍 {deliveryAddress}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  {amountInWords(round2(finalTotal))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handlePrint} className="btn-secondary">
                  <Printer size={14} />
                  {isDelivery ? 'Print Delivery Slip' : 'Print Receipt'}
                </button>
                <button onClick={onSuccess} className="btn-primary">Done</button>
              </div>
            </div>
          ) : (
            /* ── Billing form ── */
            <div className="p-6 space-y-5">

              {/* Offline banner */}
              {!isOnline && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <WifiOff size={13} />
                  <span>Offline — only Cash, Wallet &amp; COD available.</span>
                </div>
              )}

              {/* ── Delivery Details Block ────────────────────────────────── */}
              {isDelivery && (
                <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Delivery Details
                    </span>
                  </div>

                  {/* Phone — required */}
                  <div className="relative">
                    <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className={cn(
                        'input pl-8 text-sm',
                        !deliveryPhone.trim() && 'border-red-400 dark:border-red-600'
                      )}
                      placeholder="Customer phone * (required)"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                    />
                  </div>
                  {!deliveryPhone.trim() && (
                    <p className="text-[10px] text-red-500 pl-1">⚠ Phone is required</p>
                  )}

                  {/* Name — optional */}
                  <input
                    className="input text-sm"
                    placeholder="Customer name (optional)"
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                  />

                  {/* Address — required */}
                  <div className="relative">
                    <MapPin size={12} className="absolute left-3 top-3 text-slate-500" />
                    <textarea
                      className={cn(
                        'input pl-8 text-sm resize-none',
                        !deliveryAddress.trim() && 'border-red-400 dark:border-red-600'
                      )}
                      placeholder="Delivery address * (required)"
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                    />
                  </div>
                  {!deliveryAddress.trim() && (
                    <p className="text-[10px] text-red-500 pl-1">⚠ Address is required</p>
                  )}

                  {/* COD vs Prepaid toggle */}
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                      Payment Collection
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDeliveryPaymentType('cod')}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl py-3 px-2 border-2 text-xs font-semibold transition-all',
                          deliveryPaymentType === 'cod'
                            ? 'border-amber-500 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-amber-300'
                        )}
                      >
                        <Banknote size={18} className={deliveryPaymentType === 'cod' ? 'text-amber-600' : 'text-slate-400'} />
                        <span>Cash on Delivery</span>
                        <span className="text-[10px] font-normal opacity-70">Rider collects at door</span>
                      </button>
                      <button
                        onClick={() => setDeliveryPaymentType('prepaid')}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl py-3 px-2 border-2 text-xs font-semibold transition-all',
                          deliveryPaymentType === 'prepaid'
                            ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-emerald-300'
                        )}
                      >
                        <CreditCard size={18} className={deliveryPaymentType === 'prepaid' ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>Prepaid</span>
                        <span className="text-[10px] font-normal opacity-70">Paid now at counter</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Order Summary ─────────────────────────────────────────── */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-₹{round2(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
                </div>
                {defaultRoundOff !== 0 && !manualOverride && (
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Round Off</span>
                    <span>{defaultRoundOff > 0 ? '+' : ''}₹{Math.abs(defaultRoundOff).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base border-t border-slate-300 dark:border-slate-700 pt-2">
                  <span>Grand Total</span>
                  <span>₹{round2(finalTotal).toFixed(2)}</span>
                </div>
                {isCOD && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Banknote size={12} />
                    Amount to be collected by rider on delivery
                  </div>
                )}
              </div>

              {/* ── Charge Amount ─────────────────────────────────────────── */}
              <div>
                <label className="label">
                  {isCOD ? 'Amount Rider Should Collect' : 'Charge Amount'}
                  <span className="text-slate-400 font-normal ml-1">(edit if needed)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    className="input pl-7 text-lg font-bold"
                    type="number" min={0} step={0.01}
                    value={formatInputAmount(finalTotal)}
                    onChange={(e) => {
                      const val = round2(parseFloat(e.target.value) || 0);
                      setFinalTotal(val);
                      setManualOverride(true);
                      setCashEntered(formatInputAmount(val));
                    }}
                  />
                </div>
                {manualOverride && (
                  <button
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1"
                    onClick={() => {
                      setFinalTotal(defaultPayable);
                      setManualOverride(false);
                      setCashEntered(formatInputAmount(defaultPayable));
                    }}
                  >
                    Reset to ₹{defaultPayable.toFixed(2)}
                  </button>
                )}
              </div>

              {/* ── Customer info — non-delivery ─────────────────────────── */}
              {!isDelivery && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">
                      Customer Name
                      {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
                    </label>
                    <input
                      className="input"
                      placeholder={isTakeaway ? 'Recommended' : 'Optional'}
                      value={deliveryName}
                      onChange={(e) => setDeliveryName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">
                      Phone
                      {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
                    </label>
                    <input
                      className="input"
                      placeholder={isTakeaway ? 'Recommended' : 'Optional'}
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">
                      Email <span className="text-slate-400 font-normal">(receipt)</span>
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-8" type="email" placeholder="Optional"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">GSTIN <span className="text-slate-400 font-normal">(B2B)</span></label>
                    <input
                      className="input" placeholder="Optional"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Email for delivery */}
              {isDelivery && (
                <div>
                  <label className="label">
                    Email <span className="text-slate-400 font-normal">(for receipt)</span>
                  </label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-8" type="email" placeholder="Optional"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Payment Method ────────────────────────────────────────── */}
              {/* For COD: show which method rider will collect */}
              {/* For prepaid / dine-in / takeaway: full payment method grid */}
              {isCOD ? (
                <div>
                  <label className="label mb-2">
                    Rider Will Collect Via
                    <span className="text-slate-400 font-normal ml-1 text-xs">(for your records)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {COD_METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border',
                          method === m.id
                            ? 'border-amber-500 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                        )}
                      >
                        <span className="text-lg">{m.icon}</span>
                        {m.label}
                        <span className="text-[9px] text-center opacity-60 leading-tight px-1">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Payment Method</label>
                    {!isDelivery && (
                      <button
                        onClick={() => setIsSplit(!isSplit)}
                        className={cn(
                          'text-xs px-2 py-1 rounded',
                          isSplit
                            ? 'bg-amber-200 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 hover:text-white',
                        )}
                      >
                        Split Payment
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const isBlocked = !isOnline && RAZORPAY_METHODS.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleMethodSelect(m.id)}
                          disabled={isBlocked}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border relative',
                            isBlocked
                              ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400'
                              : method === m.id && !isSplit
                              ? 'border-amber-500 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600',
                          )}
                        >
                          <span className="text-lg">{m.icon}</span>
                          {m.label}
                          {!isBlocked && RAZORPAY_METHODS.includes(m.id) && (
                            <span className="text-[8px] text-emerald-500 font-semibold">via Razorpay</span>
                          )}
                          {isBlocked && <WifiOff size={10} className="absolute top-1 right-1 text-slate-400" />}
                        </button>
                      );
                    })}
                  </div>
                  {isRazorpayMethod && isOnline && (
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      📲 Razorpay checkout will open when you click Pay.
                    </p>
                  )}
                </div>
              )}

              {/* ── Cash Tendered — only for prepaid cash, not COD ────────── */}
              {method === 'cash' && !isSplit && !isCOD && (
                <div>
                  <label className="label">Cash Tendered</label>
                  <input
                    className="input text-lg font-bold" type="number"
                    value={cashEntered}
                    onChange={(e) => setCashEntered(e.target.value)}
                  />
                  {change >= 0 ? (
                    <div className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                      Change: ₹{round2(change).toFixed(2)}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-red-500">
                      Short by ₹{Math.abs(round2(change)).toFixed(2)}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[
                      round2(finalTotal),
                      Math.ceil(finalTotal / 10)  * 10,
                      Math.ceil(finalTotal / 50)  * 50,
                      Math.ceil(finalTotal / 100) * 100,
                      Math.ceil(finalTotal / 500) * 500,
                    ]
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setCashEntered(formatInputAmount(amt))}
                          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                        >
                          ₹{amt}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer button ─────────────────────────────────────────────────── */}
        {!billed && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <button
              onClick={() => billMutation.mutate()}
              disabled={!canProceed}
              className="btn-primary w-full py-3 text-base"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isRazorpayPending ? 'Waiting for payment...' : 'Processing...'}
                </>
              ) : isCOD ? (
                <>
                  <Truck size={16} />
                  Confirm COD — ₹{round2(finalTotal).toFixed(2)} on delivery
                </>
              ) : isRazorpayMethod && isOnline ? (
                `Pay ₹${round2(finalTotal).toFixed(2)} via Razorpay`
              ) : (
                `Collect ₹${round2(finalTotal).toFixed(2)}`
              )}
            </button>

            {/* Validation hint */}
            {!deliveryInfoComplete && (
              <p className="text-[11px] text-red-400 text-center mt-2">
                ⚠ Phone and delivery address are required to proceed
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// 'use client';
// import { useState } from 'react';
// import { useMutation } from '@tanstack/react-query';
// import toast from 'react-hot-toast';
// import { apiPost, apiPatch, apiFetch, api } from '@/lib/api';
// import { enqueueSync, getResolvedId, getPendingSyncItems } from '@/lib/offline';
// import { useAuthStore } from '@/store/auth.store';
// import { usePosStore } from '@/store/pos.store';
// import { useOnlineStatus } from '@/hooks/useOnlineStatus';
// import { printHtml } from '@/lib/printer';
// import { amountInWords } from '@/lib/gst';
// import { X, Printer, CheckCircle, Loader2, Mail, WifiOff, MapPin, Phone, Truck } from 'lucide-react';
// import { cn } from '@/lib/utils';

// type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';

// const RAZORPAY_METHODS: PayMethod[] = ['upi', 'card', 'credit'];

// const PAYMENT_METHODS: { id: PayMethod; label: string; icon: string }[] = [
//   { id: 'cash',          label: 'Cash',   icon: '💵' },
//   { id: 'upi',           label: 'UPI',    icon: '📱' },
//   { id: 'card',          label: 'Card',   icon: '💳' },
//   { id: 'wallet',        label: 'Wallet', icon: '👛' },
//   { id: 'credit',        label: 'Credit', icon: '📋' },
//   { id: 'complimentary', label: 'Comp',   icon: '🎁' },
// ];

// function round2(n: number): number {
//   return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
// }

// function nearestRupee(n: number): number {
//   return Math.round(round2(n));
// }

// function formatInputAmount(n: number): string {
//   return Number.isInteger(n) ? String(n) : n.toFixed(2);
// }

// interface Props {
//   shiftId?:               string | null;
//   grandTotal:             number;
//   subtotal:               number;
//   gstTotal:               number;
//   orderId:                string | null;
//   onClose:                () => void;
//   onSuccess:              () => void;
//   /* Prefilled from POS — so we don't ask twice for delivery */
//   prefillCustomerPhone?:  string;
//   prefillCustomerName?:   string;
//   prefillDeliveryAddress?: string;
// }

// export function BillingModal({
//   shiftId,
//   grandTotal: rawGrandTotal,
//   subtotal:   rawSubtotal,
//   gstTotal:   rawGstTotal,
//   orderId,
//   onClose,
//   onSuccess,
//   prefillCustomerPhone  = '',
//   prefillCustomerName   = '',
//   prefillDeliveryAddress = '',
// }: Props) {
//   const { branchId, tenantId } = useAuthStore();
//   const {
//     cart, orderType, tableId, tableName,
//     discountAmount, discountPercent,
//   } = usePosStore();
//   const isOnline = useOnlineStatus();

//   const isDelivery = orderType === 'delivery';
//   const isTakeaway = orderType === 'takeaway';

//   const exactGrandTotal = round2(rawGrandTotal);
//   const subtotal        = round2(rawSubtotal);
//   const gstTotal        = round2(rawGstTotal);
//   const defaultPayable  = nearestRupee(exactGrandTotal);
//   const defaultRoundOff = round2(defaultPayable - exactGrandTotal);

//   const [method,          setMethod]          = useState<PayMethod>('cash');
//   // For delivery: initialize from prefill props so user doesn't re-enter
//   const [customerName,    setCustomerName]    = useState(prefillCustomerName);
//   const [customerPhone,   setCustomerPhone]   = useState(prefillCustomerPhone);
//   const [customerGstin,   setCustomerGstin]   = useState('');
//   const [deliveryAddress, setDeliveryAddress] = useState(prefillDeliveryAddress);
//   const [splitPayments,   setSplitPayments]   = useState<Array<{ method: PayMethod; amount: number }>>([]);
//   const [isSplit,         setIsSplit]          = useState(false);
//   const [billed,          setBilled]           = useState(false);
//   const [billData,        setBillData]         = useState<any>(null);
//   const [customerEmail,   setCustomerEmail]    = useState('');
//   const [isRazorpayPending, setIsRazorpayPending] = useState(false);
//   const [finalTotal,      setFinalTotal]       = useState<number>(defaultPayable);
//   const [manualOverride,  setManualOverride]   = useState(false);
//   const [cashEntered,     setCashEntered]      = useState<string>(formatInputAmount(defaultPayable));

//   const cashAmount = round2(parseFloat(cashEntered) || 0);
//   const change     = round2(cashAmount - finalTotal);

//   const isRazorpayMethod = RAZORPAY_METHODS.includes(method) && !isSplit;

//   const handleMethodSelect = (m: PayMethod) => {
//     if (!isOnline && RAZORPAY_METHODS.includes(m)) {
//       toast.error(`${m.toUpperCase()} payment requires internet. Use Cash when offline.`);
//       return;
//     }
//     setMethod(m);
//   };

//   /* ── Validate delivery fields ──────────────────────────────────────────── */
//   const validateDelivery = (): boolean => {
//     if (!isDelivery) return true;
//     if (!customerPhone.trim()) {
//       toast.error('Customer phone is required for delivery orders');
//       return false;
//     }
//     if (!deliveryAddress.trim()) {
//       toast.error('Delivery address is required for delivery orders');
//       return false;
//     }
//     return true;
//   };

//   /* ── Core bill creation ────────────────────────────────────────────────── */
//   const createBillCore = async (razorpayPaymentId?: string) => {
//     const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
//     let oid = orderId;

//     if (oid?.startsWith('OFFLINE-')) {
//       const resolved = await getResolvedId(oid);
//       if (resolved) oid = resolved;
//     }

//     if (!oid) {
//       const payload = {
//         type: orderType,
//         tableId,
//         items: cart.map((i: any) => ({
//           menuItemId:  i.id,
//           quantity:    i.qty,
//           notes:       i.notes,
//           variationId: i.variationId ?? undefined,
//         })),
//         customerName:    customerName    || undefined,
//         customerPhone:   customerPhone   || undefined,
//         deliveryAddress: deliveryAddress || undefined,
//       };

//       if (isOffline) {
//         oid = `OFFLINE-${Date.now()}`;
//         await enqueueSync({
//           entityType: 'orders', entityId: oid, operation: 'create',
//           payload: { ...payload, isOfflineSync: true, offlineId: oid },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       } else {
//         const orderRes = await apiPost('/api/v1/orders', payload);
//         oid = orderRes.data.id;
//       }
//     }

//     if ((discountPercent > 0 || discountAmount > 0) && oid) {
//       const discountPayload = { discountPercent, discountAmount };
//       if (isOffline) {
//         await enqueueSync({
//           entityType: `orders/${oid}/discount`, entityId: '', operation: 'update',
//           payload: { ...discountPayload, _isDiscount: true },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       } else {
//         await apiPatch(`/api/v1/orders/${oid}/discount`, discountPayload);
//       }
//     }

//     let serverGrandTotal = defaultPayable;
//     if (!isOffline && oid && !oid.startsWith('OFFLINE-')) {
//       try {
//         const orderRes = await apiFetch(`/api/v1/orders/${oid}`);
//         serverGrandTotal = round2(Number(orderRes.data.grandTotal));
//       } catch { /* fallback */ }
//     }

//     const billAmount = manualOverride ? round2(finalTotal) : serverGrandTotal;
//     setFinalTotal(billAmount);
//     if (!manualOverride && method === 'cash') {
//       setCashEntered(formatInputAmount(billAmount));
//     }

//     const payments = isSplit
//       ? splitPayments
//       : [{
//           method,
//           amount: method === 'cash' ? round2(parseFloat(cashEntered) || 0) : billAmount,
//           ...(razorpayPaymentId ? { referenceNo: razorpayPaymentId } : {}),
//         }];

//     const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
//     if (totalPaid < billAmount - 0.01) {
//       throw new Error(
//         `Payment ₹${round2(totalPaid).toFixed(2)} is less than bill amount ₹${billAmount.toFixed(2)}. Please adjust.`
//       );
//     }

//     const billPayload = {
//       orderId: oid, branchId, tenantId,
//       shiftId:       shiftId       || undefined,
//       customerName:  customerName  || undefined,
//       customerPhone: customerPhone || undefined,
//       customerGstin: customerGstin || undefined,
//       payments,
//     };

//     if (isOffline) {
//       const unsentItems = cart.filter((i: any) => !i.alreadySent);
//       if (unsentItems.length > 0 && oid) {
//         await enqueueSync({
//           entityType: `orders/${oid}/items`, entityId: '', operation: 'create',
//           payload: {
//             items: unsentItems.map((i: any) => ({
//               menuItemId:  i.id, quantity: i.qty,
//               notes: i.notes || undefined, variationId: i.variationId || undefined,
//             })),
//             isOfflineSync: true,
//           },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       }

//       if (oid!.startsWith('OFFLINE-')) {
//         const queue = await getPendingSyncItems();
//         const orderExists = queue.some(
//           (q) => q.entityId === oid && q.entityType === 'orders' && q.operation === 'create'
//         );
//         if (!orderExists) {
//           throw new Error('This order has already synced but the bill link is missing. Please refresh and re-open the order.');
//         }
//       }

//       await enqueueSync({
//         entityType: 'billing/bills', entityId: oid!, operation: 'create',
//         payload: { ...billPayload, isOfflineSync: true },
//         branchId: branchId || '', tenantId: tenantId || '',
//       });

//       return {
//         id: oid!,
//         billNumber: `OFF-${Math.floor(Math.random() * 10000)}`,
//         serverGrandTotal: billAmount,
//         gstSummary: [],
//       };
//     }

//     const res = await apiPost('/api/v1/billing/bills', billPayload);
//     return { ...res.data, serverGrandTotal: billAmount };
//   };

//   const billMutation = useMutation({
//     networkMode: 'always',
//     mutationFn: async () => {
//       if (!validateDelivery()) throw new Error('Validation failed');

//       if (isRazorpayMethod && isOnline) {
//         return new Promise<any>((resolve, reject) => {
//           setIsRazorpayPending(true);
//           api.post('/api/v1/billing/razorpay/create-order', { amount: finalTotal })
//             .then((res) => {
//               const order = res.data?.data || res.data;
//               const options = {
//                 key:         order.keyId,
//                 amount:      order.amount,
//                 currency:    order.currency,
//                 name:        'Bill Payment',
//                 description: 'POS Bill',
//                 order_id:    order.orderId,
//                 handler: async (response: any) => {
//                   try {
//                     await api.post('/api/v1/billing/razorpay/verify-payment', {
//                       razorpayOrderId:   response.razorpay_order_id,
//                       razorpayPaymentId: response.razorpay_payment_id,
//                       razorpaySignature: response.razorpay_signature,
//                     });
//                     const bill = await createBillCore(response.razorpay_payment_id);
//                     resolve(bill);
//                   } catch (e) {
//                     reject(e);
//                   } finally {
//                     setIsRazorpayPending(false);
//                   }
//                 },
//                 modal: {
//                   ondismiss: () => {
//                     setIsRazorpayPending(false);
//                     reject(new Error('Payment was cancelled.'));
//                   },
//                 },
//                 theme: { color: '#f59e0b' },
//               };
//               const rzp = new (window as any).Razorpay(options);
//               rzp.on('payment.failed', (response: any) => {
//                 setIsRazorpayPending(false);
//                 reject(new Error(response.error?.description || 'Payment failed'));
//               });
//               rzp.open();
//             })
//             .catch((e) => { setIsRazorpayPending(false); reject(e); });
//         });
//       }

//       return createBillCore();
//     },
//     onSuccess: (data) => {
//       setBillData(data);
//       setFinalTotal(round2(data.serverGrandTotal));
//       setBilled(true);
//       toast.success('Bill created successfully!');

//       if (customerEmail.trim() && data?.id) {
//         apiPost(`/api/v1/billing/bills/${data.id}/email`, { email: customerEmail.trim() })
//           .then(() => toast.success('Receipt emailed to ' + customerEmail.trim()))
//           .catch(() => toast.error('Could not send email receipt.'));
//       }
//     },
//     onError: (err: any) => {
//       const msg = err?.response?.data?.message || err?.message || 'Billing failed';
//       if (msg !== 'Validation failed') toast.error(msg);
//     },
//   });

//   const handlePrint = () => {
//     if (!billData) return;
//     try {
//       printHtml({
//         restaurantName:  'Dine&Stay Restaurant',
//         billNumber:      billData.billNumber,
//         invoiceDate:     new Date().toLocaleString('en-IN'),
//         tableName:       tableName  || undefined,
//         orderType,
//         customerName:    customerName    || undefined,
//         customerPhone:   customerPhone   || undefined,
//         customerGstin:   customerGstin   || undefined,
//         deliveryAddress: isDelivery ? (deliveryAddress || undefined) : undefined,
//         items: cart.map((i: any) => ({
//           name:   i.name,
//           qty:    i.qty,
//           rate:   round2(i.price),
//           amount: round2(i.price * i.qty),
//         })),
//         subtotal,
//         discountAmount: round2(discountAmount),
//         totalTax:       gstTotal,
//         grandTotal:     round2(finalTotal),
//         payments: isSplit
//           ? splitPayments
//           : [{ method, amount: method === 'cash' ? cashAmount : round2(finalTotal) }],
//         changeAmount: method === 'cash' && !isSplit ? Math.max(0, round2(change)) : 0,
//         gstSummary:   billData.gstSummary,
//       });
//     } catch (err) {
//       console.error('Print failed:', err);
//       toast.error('Print failed. Check browser console.');
//     }
//   };

//   const isPending = billMutation.isPending || isRazorpayPending;

//   // For delivery: show a read-only summary of the pre-filled info
//   // instead of editable fields (they were filled in POS already)
//   const hasDeliveryPrefill = isDelivery && (prefillCustomerPhone || prefillCustomerName || prefillDeliveryAddress);

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
//       <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

//         {/* Header */}
//         <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
//           <div className="flex items-center gap-2">
//             {isDelivery && <Truck size={18} className="text-amber-500" />}
//             <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//               {billed
//                 ? 'Bill Generated ✓'
//                 : isDelivery
//                 ? 'Delivery Bill'
//                 : isTakeaway
//                 ? 'Takeaway Bill'
//                 : 'Generate Bill'
//               }
//             </h2>
//           </div>
//           <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {billed ? (
//             /* ── Success screen ── */
//             <div className="p-6 space-y-4">
//               <div className="flex flex-col items-center gap-3 py-4">
//                 <CheckCircle size={48} className="text-emerald-600 dark:text-emerald-400" />
//                 <div className="text-center">
//                   <div className="text-slate-900 dark:text-white font-bold text-xl">₹{round2(finalTotal).toFixed(2)}</div>
//                   <div className="text-slate-500 dark:text-slate-400 text-sm">Bill #{billData?.billNumber}</div>
//                   {method === 'cash' && change > 0 && (
//                     <div className="mt-2 text-amber-600 dark:text-amber-400 font-semibold text-lg">
//                       Change: ₹{round2(change).toFixed(2)}
//                     </div>
//                   )}
//                   {isDelivery && customerPhone && (
//                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
//                       📞 {customerPhone}
//                     </div>
//                   )}
//                   {isDelivery && deliveryAddress && (
//                     <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
//                       📍 {deliveryAddress}
//                     </div>
//                   )}
//                 </div>
//                 <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
//                   {amountInWords(round2(finalTotal))}
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <button onClick={handlePrint} className="btn-secondary">
//                   <Printer size={14} /> Print
//                   {isDelivery ? ' Delivery Slip' : ' Receipt'}
//                 </button>
//                 <button onClick={onSuccess} className="btn-primary">Done</button>
//               </div>
//             </div>
//           ) : (
//             /* ── Billing form ── */
//             <div className="p-6 space-y-5">

//               {/* Offline banner */}
//               {!isOnline && (
//                 <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
//                   <WifiOff size={13} />
//                   <span>You are offline — only <strong>Cash</strong>, Wallet &amp; Complimentary payments are available.</span>
//                 </div>
//               )}

//               {/* ── Delivery info ──
//                   If pre-filled from POS: show read-only summary (no re-entry needed).
//                   If somehow empty (e.g. opened without going through POS): show editable fields.
//               */}
//               {isDelivery && (
//                 hasDeliveryPrefill ? (
//                   /* Read-only delivery info summary */
//                   <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
//                     <div className="flex items-center gap-2 mb-1">
//                       <Truck size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
//                       <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Delivery Details</span>
//                       <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
//                         ✓ Filled from order
//                       </span>
//                     </div>
//                     {customerPhone && (
//                       <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
//                         <Phone size={12} className="text-slate-400 flex-shrink-0" />
//                         <span>{customerPhone}</span>
//                       </div>
//                     )}
//                     {customerName && (
//                       <div className="text-sm text-slate-600 dark:text-slate-400 pl-5">
//                         {customerName}
//                       </div>
//                     )}
//                     {deliveryAddress && (
//                       <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
//                         <MapPin size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
//                         <span>{deliveryAddress}</span>
//                       </div>
//                     )}
//                     {/* Allow editing if needed */}
//                     <button
//                       className="text-[11px] text-amber-600 dark:text-amber-400 underline underline-offset-2 mt-1"
//                       onClick={() => {
//                         // Toggle to editable by clearing prefill sentinel
//                         // We just show a note — fields are already state-bound so user can scroll and edit
//                       }}
//                     >
//                       Wrong details? Edit below ↓
//                     </button>
//                     {/* Editable overrides — collapsed but accessible */}
//                     <div className="pt-2 space-y-2 border-t border-amber-200 dark:border-amber-800/50">
//                       <div className="relative">
//                         <Phone size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
//                         <input
//                           className="input pl-8 text-sm"
//                           placeholder="Phone (edit if needed)"
//                           value={customerPhone}
//                           onChange={(e) => setCustomerPhone(e.target.value)}
//                         />
//                       </div>
//                       <input
//                         className="input text-sm"
//                         placeholder="Name (edit if needed)"
//                         value={customerName}
//                         onChange={(e) => setCustomerName(e.target.value)}
//                       />
//                       <div className="relative">
//                         <MapPin size={11} className="absolute left-3 top-3 text-slate-500" />
//                         <textarea
//                           className="input pl-8 text-sm resize-none"
//                           placeholder="Address (edit if needed)"
//                           rows={2}
//                           value={deliveryAddress}
//                           onChange={(e) => setDeliveryAddress(e.target.value)}
//                         />
//                       </div>
//                     </div>
//                   </div>
//                 ) : (
//                   /* No prefill — show full editable form (fallback) */
//                   <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
//                     <div className="flex items-center gap-2">
//                       <Truck size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
//                       <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Delivery Details</span>
//                       <span className="text-[10px] text-red-500 font-semibold ml-auto">* Required</span>
//                     </div>

//                     <div className="space-y-2">
//                       <div className="relative">
//                         <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
//                         <input
//                           className={cn('input pl-8 text-sm', !customerPhone.trim() && 'border-red-400 dark:border-red-600')}
//                           placeholder="Customer phone * (required)"
//                           value={customerPhone}
//                           onChange={(e) => setCustomerPhone(e.target.value)}
//                         />
//                       </div>
//                       {!customerPhone.trim() && (
//                         <p className="text-[10px] text-red-500 flex items-center gap-1 pl-1">
//                           ⚠ Phone is mandatory for delivery
//                         </p>
//                       )}

//                       <input
//                         className="input text-sm"
//                         placeholder="Customer name (optional)"
//                         value={customerName}
//                         onChange={(e) => setCustomerName(e.target.value)}
//                       />

//                       <div className="relative">
//                         <MapPin size={12} className="absolute left-3 top-3 text-slate-500" />
//                         <textarea
//                           className={cn('input pl-8 text-sm resize-none', !deliveryAddress.trim() && 'border-red-400 dark:border-red-600')}
//                           placeholder="Delivery address * (required)"
//                           rows={2}
//                           value={deliveryAddress}
//                           onChange={(e) => setDeliveryAddress(e.target.value)}
//                         />
//                       </div>
//                       {!deliveryAddress.trim() && (
//                         <p className="text-[10px] text-red-500 flex items-center gap-1 pl-1">
//                           ⚠ Address is mandatory for delivery
//                         </p>
//                       )}
//                     </div>
//                   </div>
//                 )
//               )}

//               {/* Summary */}
//               <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
//                 <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                   <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
//                 </div>
//                 {discountAmount > 0 && (
//                   <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
//                     <span>Discount ({discountPercent}%)</span>
//                     <span>-₹{round2(discountAmount).toFixed(2)}</span>
//                   </div>
//                 )}
//                 <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                   <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
//                 </div>
//                 {defaultRoundOff !== 0 && !manualOverride && (
//                   <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                     <span>Round Off</span>
//                     <span>{defaultRoundOff > 0 ? '+' : ''}₹{Math.abs(defaultRoundOff).toFixed(2)}</span>
//                   </div>
//                 )}
//                 <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base border-t border-slate-300 dark:border-slate-700 pt-2">
//                   <span>Grand Total</span>
//                   <span>₹{round2(finalTotal).toFixed(2)}</span>
//                 </div>
//               </div>

//               {/* Charge amount */}
//               <div>
//                 <label className="label">
//                   Charge Amount
//                   <span className="text-slate-400 font-normal ml-1">(edit if needed)</span>
//                 </label>
//                 <div className="relative">
//                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
//                   <input
//                     className="input pl-7 text-lg font-bold"
//                     type="number" min={0} step={0.01}
//                     value={formatInputAmount(finalTotal)}
//                     onChange={(e) => {
//                       const val = round2(parseFloat(e.target.value) || 0);
//                       setFinalTotal(val);
//                       setManualOverride(true);
//                       setCashEntered(formatInputAmount(val));
//                     }}
//                   />
//                 </div>
//                 {manualOverride && (
//                   <button
//                     className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1"
//                     onClick={() => {
//                       setFinalTotal(defaultPayable);
//                       setManualOverride(false);
//                       setCashEntered(formatInputAmount(defaultPayable));
//                     }}
//                   >
//                     Reset to ₹{defaultPayable.toFixed(2)}
//                   </button>
//                 )}
//               </div>

//               {/* Customer info — for non-delivery */}
//               {!isDelivery && (
//                 <div className="grid grid-cols-2 gap-3">
//                   <div>
//                     <label className="label">
//                       Customer Name
//                       {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
//                     </label>
//                     <input
//                       className="input"
//                       placeholder={isTakeaway ? 'Recommended' : 'Optional'}
//                       value={customerName}
//                       onChange={(e) => setCustomerName(e.target.value)}
//                     />
//                   </div>
//                   <div>
//                     <label className="label">
//                       Phone
//                       {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
//                     </label>
//                     <input
//                       className="input"
//                       placeholder={isTakeaway ? 'Recommended' : 'Optional'}
//                       value={customerPhone}
//                       onChange={(e) => setCustomerPhone(e.target.value)}
//                     />
//                   </div>
//                   <div>
//                     <label className="label">
//                       Email <span className="text-slate-400 font-normal">(receipt)</span>
//                     </label>
//                     <div className="relative">
//                       <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//                       <input
//                         className="input pl-8" type="email" placeholder="Optional"
//                         value={customerEmail}
//                         onChange={(e) => setCustomerEmail(e.target.value)}
//                       />
//                     </div>
//                   </div>
//                   <div>
//                     <label className="label">GSTIN <span className="text-slate-400 font-normal">(B2B)</span></label>
//                     <input
//                       className="input" placeholder="Optional"
//                       value={customerGstin}
//                       onChange={(e) => setCustomerGstin(e.target.value)}
//                     />
//                   </div>
//                 </div>
//               )}

//               {/* Email for delivery */}
//               {isDelivery && (
//                 <div>
//                   <label className="label">Email <span className="text-slate-400 font-normal">(for receipt)</span></label>
//                   <div className="relative">
//                     <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//                     <input
//                       className="input pl-8" type="email" placeholder="Optional"
//                       value={customerEmail}
//                       onChange={(e) => setCustomerEmail(e.target.value)}
//                     />
//                   </div>
//                 </div>
//               )}

//               {/* Payment method */}
//               <div>
//                 <div className="flex items-center justify-between mb-2">
//                   <label className="label mb-0">Payment Method</label>
//                   <button
//                     onClick={() => setIsSplit(!isSplit)}
//                     className={cn(
//                       'text-xs px-2 py-1 rounded',
//                       isSplit
//                         ? 'bg-amber-200 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
//                         : 'text-slate-400 hover:text-white',
//                     )}
//                   >
//                     Split Payment
//                   </button>
//                 </div>
//                 <div className="grid grid-cols-3 gap-2">
//                   {PAYMENT_METHODS.map((m) => {
//                     const isBlocked = !isOnline && RAZORPAY_METHODS.includes(m.id);
//                     return (
//                       <button
//                         key={m.id}
//                         onClick={() => handleMethodSelect(m.id)}
//                         disabled={isBlocked}
//                         className={cn(
//                           'flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border relative',
//                           isBlocked
//                             ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400'
//                             : method === m.id && !isSplit
//                             ? 'border-amber-500 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
//                             : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600',
//                         )}
//                       >
//                         <span className="text-lg">{m.icon}</span>
//                         {m.label}
//                         {!isBlocked && RAZORPAY_METHODS.includes(m.id) && (
//                           <span className="text-[8px] text-emerald-500 font-semibold">via Razorpay</span>
//                         )}
//                         {isBlocked && <WifiOff size={10} className="absolute top-1 right-1 text-slate-400" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//                 {isRazorpayMethod && isOnline && (
//                   <p className="text-xs text-slate-400 mt-2 text-center">
//                     📲 Razorpay checkout will open when you click Pay.
//                   </p>
//                 )}
//               </div>

//               {/* Cash tendered */}
//               {method === 'cash' && !isSplit && (
//                 <div>
//                   <label className="label">Cash Tendered</label>
//                   <input
//                     className="input text-lg font-bold" type="number"
//                     value={cashEntered}
//                     onChange={(e) => setCashEntered(e.target.value)}
//                   />
//                   {change >= 0 ? (
//                     <div className="mt-1 text-sm text-amber-600 dark:text-amber-400">
//                       Change: ₹{round2(change).toFixed(2)}
//                     </div>
//                   ) : (
//                     <div className="mt-1 text-sm text-red-500">
//                       Short by ₹{Math.abs(round2(change)).toFixed(2)}
//                     </div>
//                   )}
//                   <div className="flex gap-2 mt-2 flex-wrap">
//                     {[
//                       round2(finalTotal),
//                       Math.ceil(finalTotal / 10)  * 10,
//                       Math.ceil(finalTotal / 50)  * 50,
//                       Math.ceil(finalTotal / 100) * 100,
//                       Math.ceil(finalTotal / 500) * 500,
//                     ]
//                       .filter((v, i, arr) => arr.indexOf(v) === i)
//                       .map((amt) => (
//                         <button
//                           key={amt}
//                           onClick={() => setCashEntered(formatInputAmount(amt))}
//                           className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300"
//                         >
//                           ₹{amt}
//                         </button>
//                       ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         {!billed && (
//           <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
//             <button
//               onClick={() => billMutation.mutate()}
//               disabled={
//                 isPending ||
//                 (!isOnline && RAZORPAY_METHODS.includes(method) && !isSplit) ||
//                 (method === 'cash' && !isSplit && cashAmount < finalTotal) ||
//                 (isDelivery && (!customerPhone.trim() || !deliveryAddress.trim()))
//               }
//               className="btn-primary w-full py-3 text-base"
//             >
//               {isPending
//                 ? <><Loader2 size={16} className="animate-spin" /> {isRazorpayPending ? 'Waiting for payment...' : 'Processing...'}</>
//                 : isRazorpayMethod && isOnline
//                 ? `Pay ₹${round2(finalTotal).toFixed(2)} via Razorpay`
//                 : `Collect ₹${round2(finalTotal).toFixed(2)}`
//               }
//             </button>
//             {isDelivery && (!customerPhone.trim() || !deliveryAddress.trim()) && (
//               <p className="text-[11px] text-red-400 text-center mt-2">
//                 Fill in phone and delivery address to proceed
//               </p>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



// 'use client';
// import { useState } from 'react';
// import { useMutation } from '@tanstack/react-query';
// import toast from 'react-hot-toast';
// import { apiPost, apiPatch, apiFetch, api } from '@/lib/api';
// import { enqueueSync, getResolvedId, getPendingSyncItems } from '@/lib/offline';
// import { useAuthStore } from '@/store/auth.store';
// import { usePosStore } from '@/store/pos.store';
// import { useOnlineStatus } from '@/hooks/useOnlineStatus';
// import { printHtml } from '@/lib/printer';
// import { amountInWords } from '@/lib/gst';
// import { X, Printer, CheckCircle, Loader2, Mail, WifiOff, MapPin, Phone, Truck } from 'lucide-react';
// import { cn } from '@/lib/utils';

// type PayMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';

// const RAZORPAY_METHODS: PayMethod[] = ['upi', 'card', 'credit'];

// const PAYMENT_METHODS: { id: PayMethod; label: string; icon: string }[] = [
//   { id: 'cash',          label: 'Cash',   icon: '💵' },
//   { id: 'upi',           label: 'UPI',    icon: '📱' },
//   { id: 'card',          label: 'Card',   icon: '💳' },
//   { id: 'wallet',        label: 'Wallet', icon: '👛' },
//   { id: 'credit',        label: 'Credit', icon: '📋' },
//   { id: 'complimentary', label: 'Comp',   icon: '🎁' },
// ];

// function round2(n: number): number {
//   return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
// }

// function nearestRupee(n: number): number {
//   return Math.round(round2(n));
// }

// function formatInputAmount(n: number): string {
//   return Number.isInteger(n) ? String(n) : n.toFixed(2);
// }

// interface Props {
//   shiftId?:    string | null;
//   grandTotal:  number;
//   subtotal:    number;
//   gstTotal:    number;
//   orderId:     string | null;
//   onClose:     () => void;
//   onSuccess:   () => void;
// }

// export function BillingModal({
//   shiftId,
//   grandTotal: rawGrandTotal,
//   subtotal:   rawSubtotal,
//   gstTotal:   rawGstTotal,
//   orderId,
//   onClose,
//   onSuccess,
// }: Props) {
//   const { branchId, tenantId } = useAuthStore();
//   const {
//     cart, orderType, tableId, tableName,
//     discountAmount, discountPercent,
//   } = usePosStore();
//   const isOnline = useOnlineStatus();

//   const isDelivery = orderType === 'delivery';
//   const isTakeaway = orderType === 'takeaway';

//   const exactGrandTotal = round2(rawGrandTotal);
//   const subtotal        = round2(rawSubtotal);
//   const gstTotal        = round2(rawGstTotal);
//   const defaultPayable  = nearestRupee(exactGrandTotal);
//   const defaultRoundOff = round2(defaultPayable - exactGrandTotal);

//   const [method,         setMethod]         = useState<PayMethod>('cash');
//   const [customerName,   setCustomerName]   = useState('');
//   const [customerPhone,  setCustomerPhone]  = useState('');
//   const [customerGstin,  setCustomerGstin]  = useState('');
//   const [deliveryAddress,setDeliveryAddress]= useState('');
//   const [splitPayments,  setSplitPayments]  = useState<Array<{ method: PayMethod; amount: number }>>([]);
//   const [isSplit,        setIsSplit]         = useState(false);
//   const [billed,         setBilled]          = useState(false);
//   const [billData,       setBillData]        = useState<any>(null);
//   const [customerEmail,  setCustomerEmail]   = useState('');
//   const [isRazorpayPending, setIsRazorpayPending] = useState(false);
//   const [finalTotal,     setFinalTotal]      = useState<number>(defaultPayable);
//   const [manualOverride, setManualOverride]  = useState(false);
//   const [cashEntered,    setCashEntered]     = useState<string>(formatInputAmount(defaultPayable));

//   const cashAmount = round2(parseFloat(cashEntered) || 0);
//   const change     = round2(cashAmount - finalTotal);

//   const isRazorpayMethod = RAZORPAY_METHODS.includes(method) && !isSplit;

//   const handleMethodSelect = (m: PayMethod) => {
//     if (!isOnline && RAZORPAY_METHODS.includes(m)) {
//       toast.error(`${m.toUpperCase()} payment requires internet. Use Cash when offline.`);
//       return;
//     }
//     setMethod(m);
//   };

//   /* ── Validate delivery fields ──────────────────────────────────────────── */
//   const validateDelivery = (): boolean => {
//     if (!isDelivery) return true;
//     if (!customerPhone.trim()) {
//       toast.error('Customer phone is required for delivery orders');
//       return false;
//     }
//     if (!deliveryAddress.trim()) {
//       toast.error('Delivery address is required for delivery orders');
//       return false;
//     }
//     return true;
//   };

//   /* ── Core bill creation ────────────────────────────────────────────────── */
//   const createBillCore = async (razorpayPaymentId?: string) => {
//     const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
//     let oid = orderId;

//     if (oid?.startsWith('OFFLINE-')) {
//       const resolved = await getResolvedId(oid);
//       if (resolved) oid = resolved;
//     }

//     // 1. Create order if needed
//     if (!oid) {
//       const payload = {
//         type: orderType,
//         tableId,
//         items: cart.map((i: any) => ({
//           menuItemId:  i.id,
//           quantity:    i.qty,
//           notes:       i.notes,
//           variationId: i.variationId ?? undefined,
//         })),
//         customerName:    customerName    || undefined,
//         customerPhone:   customerPhone   || undefined,
//         deliveryAddress: deliveryAddress || undefined,
//       };

//       if (isOffline) {
//         oid = `OFFLINE-${Date.now()}`;
//         await enqueueSync({
//           entityType: 'orders', entityId: oid, operation: 'create',
//           payload: { ...payload, isOfflineSync: true, offlineId: oid },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       } else {
//         const orderRes = await apiPost('/api/v1/orders', payload);
//         oid = orderRes.data.id;
//       }
//     }

//     // 2. Apply discount
//     if ((discountPercent > 0 || discountAmount > 0) && oid) {
//       const discountPayload = { discountPercent, discountAmount };
//       if (isOffline) {
//         await enqueueSync({
//           entityType: `orders/${oid}/discount`, entityId: '', operation: 'update',
//           payload: { ...discountPayload, _isDiscount: true },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       } else {
//         await apiPatch(`/api/v1/orders/${oid}/discount`, discountPayload);
//       }
//     }

//     // 3. Fetch server total
//     let serverGrandTotal = defaultPayable;
//     if (!isOffline && oid && !oid.startsWith('OFFLINE-')) {
//       try {
//         const orderRes = await apiFetch(`/api/v1/orders/${oid}`);
//         serverGrandTotal = round2(Number(orderRes.data.grandTotal));
//       } catch { /* fallback */ }
//     }

//     const billAmount = manualOverride ? round2(finalTotal) : serverGrandTotal;
//     setFinalTotal(billAmount);
//     if (!manualOverride && method === 'cash') {
//       setCashEntered(formatInputAmount(billAmount));
//     }

//     // 4. Payments
//     const payments = isSplit
//       ? splitPayments
//       : [{
//           method,
//           amount: method === 'cash' ? round2(parseFloat(cashEntered) || 0) : billAmount,
//           ...(razorpayPaymentId ? { referenceNo: razorpayPaymentId } : {}),
//         }];

//     const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
//     if (totalPaid < billAmount - 0.01) {
//       throw new Error(
//         `Payment ₹${round2(totalPaid).toFixed(2)} is less than bill amount ₹${billAmount.toFixed(2)}. Please adjust.`
//       );
//     }

//     const billPayload = {
//       orderId: oid, branchId, tenantId,
//       shiftId:       shiftId       || undefined,
//       customerName:  customerName  || undefined,
//       customerPhone: customerPhone || undefined,
//       customerGstin: customerGstin || undefined,
//       payments,
//     };

//     // 5. Create bill
//     if (isOffline) {
//       const unsentItems = cart.filter((i: any) => !i.alreadySent);
//       if (unsentItems.length > 0 && oid) {
//         await enqueueSync({
//           entityType: `orders/${oid}/items`, entityId: '', operation: 'create',
//           payload: {
//             items: unsentItems.map((i: any) => ({
//               menuItemId:  i.id, quantity: i.qty,
//               notes: i.notes || undefined, variationId: i.variationId || undefined,
//             })),
//             isOfflineSync: true,
//           },
//           branchId: branchId || '', tenantId: tenantId || '',
//         });
//       }

//       if (oid!.startsWith('OFFLINE-')) {
//         const queue = await getPendingSyncItems();
//         const orderExists = queue.some(
//           (q) => q.entityId === oid && q.entityType === 'orders' && q.operation === 'create'
//         );
//         if (!orderExists) {
//           throw new Error('This order has already synced but the bill link is missing. Please refresh and re-open the order.');
//         }
//       }

//       await enqueueSync({
//         entityType: 'billing/bills', entityId: oid!, operation: 'create',
//         payload: { ...billPayload, isOfflineSync: true },
//         branchId: branchId || '', tenantId: tenantId || '',
//       });

//       return {
//         id: oid!,
//         billNumber: `OFF-${Math.floor(Math.random() * 10000)}`,
//         serverGrandTotal: billAmount,
//         gstSummary: [],
//       };
//     }

//     const res = await apiPost('/api/v1/billing/bills', billPayload);
//     return { ...res.data, serverGrandTotal: billAmount };
//   };

//   const billMutation = useMutation({
//     networkMode: 'always',
//     mutationFn: async () => {
//       if (!validateDelivery()) throw new Error('Validation failed');

//       if (isRazorpayMethod && isOnline) {
//         return new Promise<any>((resolve, reject) => {
//           setIsRazorpayPending(true);
//           api.post('/api/v1/billing/razorpay/create-order', { amount: finalTotal })
//             .then((res) => {
//               const order = res.data?.data || res.data;
//               const options = {
//                 key:         order.keyId,
//                 amount:      order.amount,
//                 currency:    order.currency,
//                 name:        'Bill Payment',
//                 description: 'POS Bill',
//                 order_id:    order.orderId,
//                 handler: async (response: any) => {
//                   try {
//                     await api.post('/api/v1/billing/razorpay/verify-payment', {
//                       razorpayOrderId:   response.razorpay_order_id,
//                       razorpayPaymentId: response.razorpay_payment_id,
//                       razorpaySignature: response.razorpay_signature,
//                     });
//                     const bill = await createBillCore(response.razorpay_payment_id);
//                     resolve(bill);
//                   } catch (e) {
//                     reject(e);
//                   } finally {
//                     setIsRazorpayPending(false);
//                   }
//                 },
//                 modal: {
//                   ondismiss: () => {
//                     setIsRazorpayPending(false);
//                     reject(new Error('Payment was cancelled.'));
//                   },
//                 },
//                 theme: { color: '#f59e0b' },
//               };
//               const rzp = new (window as any).Razorpay(options);
//               rzp.on('payment.failed', (response: any) => {
//                 setIsRazorpayPending(false);
//                 reject(new Error(response.error?.description || 'Payment failed'));
//               });
//               rzp.open();
//             })
//             .catch((e) => { setIsRazorpayPending(false); reject(e); });
//         });
//       }

//       return createBillCore();
//     },
//     onSuccess: (data) => {
//       setBillData(data);
//       setFinalTotal(round2(data.serverGrandTotal));
//       setBilled(true);
//       toast.success('Bill created successfully!');

//       if (customerEmail.trim() && data?.id) {
//         apiPost(`/api/v1/billing/bills/${data.id}/email`, { email: customerEmail.trim() })
//           .then(() => toast.success('Receipt emailed to ' + customerEmail.trim()))
//           .catch(() => toast.error('Could not send email receipt.'));
//       }
//     },
//     onError: (err: any) => {
//       const msg = err?.response?.data?.message || err?.message || 'Billing failed';
//       if (msg !== 'Validation failed') toast.error(msg);
//     },
//   });

//   const handlePrint = () => {
//     if (!billData) return;
//     try {
//       printHtml({
//         restaurantName:  'Dine&Stay Restaurant',
//         billNumber:      billData.billNumber,
//         invoiceDate:     new Date().toLocaleString('en-IN'),
//         tableName:       tableName  || undefined,
//         orderType,
//         customerName:    customerName    || undefined,
//         customerPhone:   customerPhone   || undefined,
//         customerGstin:   customerGstin   || undefined,
//         deliveryAddress: isDelivery ? (deliveryAddress || undefined) : undefined,
//         items: cart.map((i: any) => ({
//           name:   i.name,
//           qty:    i.qty,
//           rate:   round2(i.price),
//           amount: round2(i.price * i.qty),
//         })),
//         subtotal,
//         discountAmount: round2(discountAmount),
//         totalTax:       gstTotal,
//         grandTotal:     round2(finalTotal),
//         payments: isSplit
//           ? splitPayments
//           : [{ method, amount: method === 'cash' ? cashAmount : round2(finalTotal) }],
//         changeAmount: method === 'cash' && !isSplit ? Math.max(0, round2(change)) : 0,
//         gstSummary:   billData.gstSummary,
//       });
//     } catch (err) {
//       console.error('Print failed:', err);
//       toast.error('Print failed. Check browser console.');
//     }
//   };

//   const isPending = billMutation.isPending || isRazorpayPending;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
//       <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

//         {/* Header */}
//         <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
//           <div className="flex items-center gap-2">
//             {isDelivery && <Truck size={18} className="text-amber-500" />}
//             <h2 className="text-lg font-bold text-slate-900 dark:text-white">
//               {billed
//                 ? 'Bill Generated ✓'
//                 : isDelivery
//                 ? 'Delivery Bill'
//                 : isTakeaway
//                 ? 'Takeaway Bill'
//                 : 'Generate Bill'
//               }
//             </h2>
//           </div>
//           <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {billed ? (
//             /* ── Success screen ── */
//             <div className="p-6 space-y-4">
//               <div className="flex flex-col items-center gap-3 py-4">
//                 <CheckCircle size={48} className="text-emerald-600 dark:text-emerald-400" />
//                 <div className="text-center">
//                   <div className="text-slate-900 dark:text-white font-bold text-xl">₹{round2(finalTotal).toFixed(2)}</div>
//                   <div className="text-slate-500 dark:text-slate-400 text-sm">Bill #{billData?.billNumber}</div>
//                   {method === 'cash' && change > 0 && (
//                     <div className="mt-2 text-amber-600 dark:text-amber-400 font-semibold text-lg">
//                       Change: ₹{round2(change).toFixed(2)}
//                     </div>
//                   )}
//                   {isDelivery && customerPhone && (
//                     <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
//                       📞 {customerPhone}
//                     </div>
//                   )}
//                   {isDelivery && deliveryAddress && (
//                     <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
//                       📍 {deliveryAddress}
//                     </div>
//                   )}
//                 </div>
//                 <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
//                   {amountInWords(round2(finalTotal))}
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 gap-3">
//                 <button onClick={handlePrint} className="btn-secondary">
//                   <Printer size={14} /> Print
//                   {isDelivery ? ' Delivery Slip' : ' Receipt'}
//                 </button>
//                 <button onClick={onSuccess} className="btn-primary">Done</button>
//               </div>
//             </div>
//           ) : (
//             /* ── Billing form ── */
//             <div className="p-6 space-y-5">

//               {/* Offline banner */}
//               {!isOnline && (
//                 <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
//                   <WifiOff size={13} />
//                   <span>You are offline — only <strong>Cash</strong>, Wallet &amp; Complimentary payments are available.</span>
//                 </div>
//               )}

//               {/* Delivery address banner */}
//               {isDelivery && (
//                 <div className="rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
//                   <div className="flex items-center gap-2">
//                     <Truck size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
//                     <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
//                       Delivery Details
//                     </span>
//                     <span className="text-[10px] text-red-500 font-semibold ml-auto">* Required</span>
//                   </div>

//                   <div className="space-y-2">
//                     {/* Phone — mandatory */}
//                     <div className="relative">
//                       <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
//                       <input
//                         className={cn(
//                           'input pl-8 text-sm',
//                           !customerPhone.trim() && 'border-red-400 dark:border-red-600'
//                         )}
//                         placeholder="Customer phone * (required)"
//                         value={customerPhone}
//                         onChange={(e) => setCustomerPhone(e.target.value)}
//                       />
//                     </div>
//                     {!customerPhone.trim() && (
//                       <p className="text-[10px] text-red-500 flex items-center gap-1 pl-1">
//                         ⚠ Phone is mandatory for delivery
//                       </p>
//                     )}

//                     {/* Name */}
//                     <input
//                       className="input text-sm"
//                       placeholder="Customer name (optional)"
//                       value={customerName}
//                       onChange={(e) => setCustomerName(e.target.value)}
//                     />

//                     {/* Address — mandatory */}
//                     <div className="relative">
//                       <MapPin size={12} className="absolute left-3 top-3 text-slate-500" />
//                       <textarea
//                         className={cn(
//                           'input pl-8 text-sm resize-none',
//                           !deliveryAddress.trim() && 'border-red-400 dark:border-red-600'
//                         )}
//                         placeholder="Delivery address * (required)"
//                         rows={2}
//                         value={deliveryAddress}
//                         onChange={(e) => setDeliveryAddress(e.target.value)}
//                       />
//                     </div>
//                     {!deliveryAddress.trim() && (
//                       <p className="text-[10px] text-red-500 flex items-center gap-1 pl-1">
//                         ⚠ Address is mandatory for delivery
//                       </p>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {/* Summary */}
//               <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
//                 <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                   <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
//                 </div>
//                 {discountAmount > 0 && (
//                   <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
//                     <span>Discount ({discountPercent}%)</span>
//                     <span>-₹{round2(discountAmount).toFixed(2)}</span>
//                   </div>
//                 )}
//                 <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                   <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
//                 </div>
//                 {defaultRoundOff !== 0 && !manualOverride && (
//                   <div className="flex justify-between text-slate-500 dark:text-slate-400">
//                     <span>Round Off</span>
//                     <span>{defaultRoundOff > 0 ? '+' : ''}₹{Math.abs(defaultRoundOff).toFixed(2)}</span>
//                   </div>
//                 )}
//                 <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base border-t border-slate-300 dark:border-slate-700 pt-2">
//                   <span>Grand Total</span>
//                   <span>₹{round2(finalTotal).toFixed(2)}</span>
//                 </div>
//               </div>

//               {/* Charge amount */}
//               <div>
//                 <label className="label">
//                   Charge Amount
//                   <span className="text-slate-400 font-normal ml-1">(edit if needed)</span>
//                 </label>
//                 <div className="relative">
//                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
//                   <input
//                     className="input pl-7 text-lg font-bold"
//                     type="number" min={0} step={0.01}
//                     value={formatInputAmount(finalTotal)}
//                     onChange={(e) => {
//                       const val = round2(parseFloat(e.target.value) || 0);
//                       setFinalTotal(val);
//                       setManualOverride(true);
//                       setCashEntered(formatInputAmount(val));
//                     }}
//                   />
//                 </div>
//                 {manualOverride && (
//                   <button
//                     className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1"
//                     onClick={() => {
//                       setFinalTotal(defaultPayable);
//                       setManualOverride(false);
//                       setCashEntered(formatInputAmount(defaultPayable));
//                     }}
//                   >
//                     Reset to ₹{defaultPayable.toFixed(2)}
//                   </button>
//                 )}
//               </div>

//               {/* Customer info — for non-delivery (delivery has its own section above) */}
//               {!isDelivery && (
//                 <div className="grid grid-cols-2 gap-3">
//                   <div>
//                     <label className="label">
//                       Customer Name
//                       {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
//                     </label>
//                     <input
//                       className="input"
//                       placeholder={isTakeaway ? 'Recommended' : 'Optional'}
//                       value={customerName}
//                       onChange={(e) => setCustomerName(e.target.value)}
//                     />
//                   </div>
//                   <div>
//                     <label className="label">
//                       Phone
//                       {isTakeaway && <span className="text-slate-400 font-normal ml-1">(recommended)</span>}
//                     </label>
//                     <input
//                       className="input"
//                       placeholder={isTakeaway ? 'Recommended' : 'Optional'}
//                       value={customerPhone}
//                       onChange={(e) => setCustomerPhone(e.target.value)}
//                     />
//                   </div>
//                   <div>
//                     <label className="label">
//                       Email <span className="text-slate-400 font-normal">(receipt)</span>
//                     </label>
//                     <div className="relative">
//                       <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//                       <input
//                         className="input pl-8" type="email" placeholder="Optional"
//                         value={customerEmail}
//                         onChange={(e) => setCustomerEmail(e.target.value)}
//                       />
//                     </div>
//                   </div>
//                   <div>
//                     <label className="label">GSTIN <span className="text-slate-400 font-normal">(B2B)</span></label>
//                     <input
//                       className="input" placeholder="Optional"
//                       value={customerGstin}
//                       onChange={(e) => setCustomerGstin(e.target.value)}
//                     />
//                   </div>
//                 </div>
//               )}

//               {/* Email for delivery */}
//               {isDelivery && (
//                 <div>
//                   <label className="label">Email <span className="text-slate-400 font-normal">(for receipt)</span></label>
//                   <div className="relative">
//                     <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//                     <input
//                       className="input pl-8" type="email" placeholder="Optional"
//                       value={customerEmail}
//                       onChange={(e) => setCustomerEmail(e.target.value)}
//                     />
//                   </div>
//                 </div>
//               )}

//               {/* Payment method */}
//               <div>
//                 <div className="flex items-center justify-between mb-2">
//                   <label className="label mb-0">Payment Method</label>
//                   <button
//                     onClick={() => setIsSplit(!isSplit)}
//                     className={cn(
//                       'text-xs px-2 py-1 rounded',
//                       isSplit
//                         ? 'bg-amber-200 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
//                         : 'text-slate-400 hover:text-white',
//                     )}
//                   >
//                     Split Payment
//                   </button>
//                 </div>
//                 <div className="grid grid-cols-3 gap-2">
//                   {PAYMENT_METHODS.map((m) => {
//                     const isBlocked = !isOnline && RAZORPAY_METHODS.includes(m.id);
//                     return (
//                       <button
//                         key={m.id}
//                         onClick={() => handleMethodSelect(m.id)}
//                         disabled={isBlocked}
//                         className={cn(
//                           'flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition-all border relative',
//                           isBlocked
//                             ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-400'
//                             : method === m.id && !isSplit
//                             ? 'border-amber-500 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
//                             : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600',
//                         )}
//                       >
//                         <span className="text-lg">{m.icon}</span>
//                         {m.label}
//                         {!isBlocked && RAZORPAY_METHODS.includes(m.id) && (
//                           <span className="text-[8px] text-emerald-500 font-semibold">via Razorpay</span>
//                         )}
//                         {isBlocked && <WifiOff size={10} className="absolute top-1 right-1 text-slate-400" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//                 {isRazorpayMethod && isOnline && (
//                   <p className="text-xs text-slate-400 mt-2 text-center">
//                     📲 Razorpay checkout will open when you click Pay.
//                   </p>
//                 )}
//               </div>

//               {/* Cash tendered */}
//               {method === 'cash' && !isSplit && (
//                 <div>
//                   <label className="label">Cash Tendered</label>
//                   <input
//                     className="input text-lg font-bold" type="number"
//                     value={cashEntered}
//                     onChange={(e) => setCashEntered(e.target.value)}
//                   />
//                   {change >= 0 ? (
//                     <div className="mt-1 text-sm text-amber-600 dark:text-amber-400">
//                       Change: ₹{round2(change).toFixed(2)}
//                     </div>
//                   ) : (
//                     <div className="mt-1 text-sm text-red-500">
//                       Short by ₹{Math.abs(round2(change)).toFixed(2)}
//                     </div>
//                   )}
//                   <div className="flex gap-2 mt-2 flex-wrap">
//                     {[
//                       round2(finalTotal),
//                       Math.ceil(finalTotal / 10)  * 10,
//                       Math.ceil(finalTotal / 50)  * 50,
//                       Math.ceil(finalTotal / 100) * 100,
//                       Math.ceil(finalTotal / 500) * 500,
//                     ]
//                       .filter((v, i, arr) => arr.indexOf(v) === i)
//                       .map((amt) => (
//                         <button
//                           key={amt}
//                           onClick={() => setCashEntered(formatInputAmount(amt))}
//                           className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300"
//                         >
//                           ₹{amt}
//                         </button>
//                       ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         {!billed && (
//           <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
//             <button
//               onClick={() => billMutation.mutate()}
//               disabled={
//                 isPending ||
//                 (!isOnline && RAZORPAY_METHODS.includes(method) && !isSplit) ||
//                 (method === 'cash' && !isSplit && cashAmount < finalTotal) ||
//                 (isDelivery && (!customerPhone.trim() || !deliveryAddress.trim()))
//               }
//               className="btn-primary w-full py-3 text-base"
//             >
//               {isPending
//                 ? <><Loader2 size={16} className="animate-spin" /> {isRazorpayPending ? 'Waiting for payment...' : 'Processing...'}</>
//                 : isRazorpayMethod && isOnline
//                 ? `Pay ₹${round2(finalTotal).toFixed(2)} via Razorpay`
//                 : `Collect ₹${round2(finalTotal).toFixed(2)}`
//               }
//             </button>
//             {isDelivery && (!customerPhone.trim() || !deliveryAddress.trim()) && (
//               <p className="text-[11px] text-red-400 text-center mt-2">
//                 Fill in phone and delivery address to proceed
//               </p>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }