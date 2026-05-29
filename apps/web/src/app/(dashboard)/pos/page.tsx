'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiFetch, apiPost } from '@/lib/api';
import {
  cacheCategories, getCachedCategories,
  cacheMenuItems, getCachedMenuItems,
  saveOrderLocally, enqueueSync, getLocalOrders
} from '@/lib/offline';
import { usePosStore } from '@/store/pos.store';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';
import { BillingModal } from '@/components/billing/BillingModal';
import { TablePickerModal } from '@/components/pos/TablePickerModal';
import { OrderTypeSelector } from '@/components/pos/OrderTypeSelector';
import { MenuGridSkeleton, ListRowSkeleton } from '@/components/ui/Skeleton';
import {
  Search, Plus, Minus, Trash2, Printer, CreditCard, UtensilsCrossed,
  Tag, ChevronDown, ClipboardList, X, Gift, RotateCcw, Clock,
  CheckCircle2, ChefHat, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Variation { id: string; name: string; price: number; }
interface PickerItem {
  id: string; name: string; price: number;
  cgstRate: number; sgstRate: number; isVeg: boolean;
  variations: Variation[];
}

/* ─── Helper: extract GST rates from menu item ───────────────────────────── */
function extractGstRates(item: any): { cgstRate: number; sgstRate: number; igstRate: number } {
  if (item.gstRate && typeof item.gstRate === 'object') {
    return {
      cgstRate: Number(item.gstRate.cgstRate ?? 0),
      sgstRate: Number(item.gstRate.sgstRate ?? 0),
      igstRate: Number(item.gstRate.igstRate ?? 0),
    };
  }
  const totalRate = Number(item.gstRate ?? 0);
  return {
    cgstRate: Number(item.cgstRate ?? totalRate / 2),
    sgstRate: Number(item.sgstRate ?? totalRate / 2),
    igstRate: Number(item.igstRate ?? 0),
  };
}

/* ─── Item Picker Modal ───────────────────────────────────────────────────── */
function ItemPickerModal({
  item, onClose, onAdd,
}: {
  item: PickerItem;
  onClose: () => void;
  onAdd: (
    variationId: string | null,
    variationName: string | null,
    price: number,
    qty: number,
    notes: string,
  ) => void;
}) {
  const [selectedVar, setSelectedVar] = useState<Variation | null>(
    item.variations.length > 0 ? item.variations[0] : null,
  );
  const [qty,   setQty]   = useState(1);
  const [notes, setNotes] = useState('');
  const effectivePrice = selectedVar ? selectedVar.price : item.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-sm shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
            <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold">₹{effectivePrice.toFixed(2)}</span>
          </div>
          <button onClick={onClose} className="text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {item.variations.length > 0 && (
            <div>
              <label className="label mb-2">Variation</label>
              <div className="flex flex-wrap gap-2">
                {item.variations.map((v) => (
                  <button key={v.id} onClick={() => setSelectedVar(v)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-center min-w-[80px]',
                      selectedVar?.id === v.id
                        ? 'bg-amber-500 border-amber-500 text-slate-900'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-amber-500',
                    )}>
                    <div>{v.name}</div>
                    <div className="text-xs font-bold mt-0.5">₹{v.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label mb-2">Quantity</label>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <Minus size={12} />
              </button>
              <input
                className="flex-1 text-center bg-transparent text-slate-900 dark:text-white font-bold text-lg outline-none w-12"
                type="number" min={1} value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button onClick={() => setQty(qty + 1)}
                className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                <Plus size={12} />
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {[1, 2, 3, 5, 10].map((n) => (
                <button key={n} onClick={() => setQty(n)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    qty === n ? 'bg-amber-500 text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white',
                  )}>
                  +{n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label mb-1">Special Instructions (optional)</label>
            <input className="input text-sm" placeholder="e.g. Extra spicy, no onion..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => {
              if (qty < 1) return;
              onAdd(selectedVar?.id ?? null, selectedVar?.name ?? null, effectivePrice, qty, notes);
              onClose();
            }}
            className="btn-primary flex-1"
          >
            Add to Order — ₹{(effectivePrice * qty).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Advance Order Modal ─────────────────────────────────────────────────── */
function AdvanceOrderModal({
  onClose, onConfirm,
}: {
  onClose: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [dt, setDt] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 w-full max-w-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Schedule Advance Order</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>
        <div>
          <label className="label">Pickup / Delivery Date & Time</label>
          <input className="input" type="datetime-local" value={dt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setDt(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => { if (dt) { onConfirm(new Date(dt)); onClose(); } }}
            disabled={!dt}
            className="btn-primary flex-1"
          >
            <Clock size={13} /> Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main POS Page ───────────────────────────────────────────────────────── */
export default function PosPage() {
  const qc = useQueryClient();

  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [search,           setSearch]           = useState('');
  const [selectedCat,      setSelectedCat]      = useState<string | null>(null);
  const [showBilling,      setShowBilling]      = useState(false);
  const [showTablePicker,  setShowTablePicker]  = useState(false);
  const [showOpenOrders,   setShowOpenOrders]   = useState(false);
  const [showMobileCart,   setShowMobileCart]   = useState(false);
  const [pickerItem,       setPickerItem]       = useState<PickerItem | null>(null);
  const [showAdvanceOrder, setShowAdvanceOrder] = useState(false);
  const [isComplimentary,  setIsComplimentary]  = useState(false);
  const [isSalesReturn,    setIsSalesReturn]    = useState(false);
  const [scheduledAt,      setScheduledAt]      = useState<Date | null>(null);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<string | null>(null);
  const [confirmedGrandTotal, setConfirmedGrandTotal] = useState<number | null>(null);

  const { user, branchId } = useAuthStore();

  const { data: shift } = useQuery({
    queryKey: ['current-shift', branchId],
    queryFn:  () => apiFetch('/api/v1/shifts/current').then((r) => r.data).catch(() => null),
  });

  const {
    cart, addItem, updateQty, removeItem, clearCart,
    currentOrder, setCurrentOrder, setCart,
    orderType, setOrderType,
    tableId, tableName, setTable,
    covers,
    discountPercent, discountAmount, setDiscount,
  } = usePosStore();

  const resetPosState = useCallback(() => {
    clearCart();
    setCurrentOrder(null);
    setCurrentOrderNumber(null);
    setIsComplimentary(false);
    setIsSalesReturn(false);
    setScheduledAt(null);
    setDiscount(0, 0);
    setTable(null, null);
    setConfirmedGrandTotal(null);
  }, [clearCart, setCurrentOrder, setDiscount, setTable]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    networkMode: 'always',
    queryFn: async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Offline');
        const r = await apiFetch('/api/v1/menu/categories');
        await cacheCategories(r.data);
        return r.data;
      } catch (err) {
        return getCachedCategories();
      }
    },
  });

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ['menuItems', selectedCat],
    networkMode: 'always',
    queryFn: async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Offline');
        const r = await apiFetch(`/api/v1/menu/items${selectedCat ? `?categoryId=${selectedCat}` : ''}`);
        await cacheMenuItems(r.data);
        return r.data;
      } catch (err) {
        const allItems = await getCachedMenuItems();
        if (selectedCat) return allItems.filter(i => i.categoryId === selectedCat);
        return allItems;
      }
    },
  });

  const { data: openOrders, isLoading: isLoadingOpenOrders, refetch: refetchOpenOrders } = useQuery({
    queryKey: ['open-orders-pos', branchId],
    enabled: showOpenOrders,
    networkMode: 'always',
    queryFn: async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Offline');
        const res = await apiFetch('/api/v1/orders?status=draft,placed,confirmed,preparing,ready,served&limit=50');
        for (const order of res.data) {
          await saveOrderLocally({ ...order, branchId });
        }
        return res.data;
      } catch (err) {
        if (!branchId) return [];
        const local = await getLocalOrders(branchId);
        return local.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }
    },
    staleTime:       10_000,
    refetchInterval: 30_000,
  });

  const [isOpeningDropdown, setIsOpeningDropdown] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  // ── Socket events ──────────────────────────────────────────────────────────
  const handleOrderEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
  }, [qc]);

  useSocket('order:created',     handleOrderEvent);
  useSocket('order:itemsAdded',  handleOrderEvent);
  useSocket('order:statusChanged', handleOrderEvent);

  const handleKdsChange = useCallback((payload: any) => {
    qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
    const store = usePosStore.getState();
    const activeOrderId = store.currentOrder;
    if (!payload?.orderId || !activeOrderId || activeOrderId !== payload.orderId) return;
    let changed = false;
    const updatedCart = store.cart.map((c: any) => {
      if (c.alreadySent && c.cartKey === payload.itemId && c.kdsStatus !== payload.status) {
        changed = true;
        return { ...c, kdsStatus: payload.status };
      }
      return c;
    });
    if (changed) store.setCart(updatedCart);
  }, [qc]);

  useSocket('kds:itemStatusChanged', handleKdsChange);

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i: any) => i.name.toLowerCase().includes(q) || i.shortCode?.toLowerCase().includes(q),
    );
  }, [items, search]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s: number, i: any) => s + i.price * i.qty, 0);

  const gstTotal = cart.reduce((s: number, i: any) => {
    const price          = Number(i.price    || 0);
    const qty            = Number(i.qty      || 0);
    const cgst           = Number(i.cgstRate || 0);
    const sgst           = Number(i.sgstRate || 0);
    const lineSubtotal   = price * qty;
    const lineDiscounted = lineSubtotal * (1 - Number(discountPercent || 0) / 100);
    return s + ((cgst + sgst) / 100) * lineDiscounted;
  }, 0);

  const rawGrandTotal     = subtotal - discountAmount + gstTotal;
  const grandTotal        = Math.round(rawGrandTotal);
  const billingGrandTotal = confirmedGrandTotal ?? grandTotal;

  // ── Server helpers ─────────────────────────────────────────────────────────
  const serverApplyDiscount = async (pct: number, amt: number, orderId: string) => {
    try {
      await api.patch(`/api/v1/orders/${orderId}/discount`, {
        discountPercent: pct,
        discountAmount: amt,
      });
    } catch {
      toast.error('Could not apply discount on server');
    }
  };

  const fetchServerTotal = useCallback(async (orderId: string) => {
    try {
      const res = await apiFetch(`/api/v1/orders/${orderId}`);
      setConfirmedGrandTotal(Number(res.data.grandTotal));
    } catch { /* fall back to frontend calculation */ }
  }, []);

  const handleOpenBilling = useCallback(async () => {
    if (user?.role === 'cashier' && !shift?.id) {
      toast.error('You must open a shift first!');
      return;
    }
    if (currentOrder) {
      setIsBillingLoading(true);
      await fetchServerTotal(currentOrder);
      setIsBillingLoading(false);
    }
    setShowBilling(true);
  }, [user, shift, currentOrder, fetchServerTotal]);

  // ── Item click ─────────────────────────────────────────────────────────────
  const handleItemClick = (item: any) => {
    const activeVariations = (item.variations || []).filter((v: any) => v.isActive);
    const { cgstRate, sgstRate } = extractGstRates(item);

    if (activeVariations.length > 0) {
      setPickerItem({ ...item, cgstRate, sgstRate, variations: activeVariations });
    } else {
      addItem({
        id:       item.id,
        name:     item.name,
        price:    Number(item.price || 0),
        cgstRate,
        sgstRate,
        isVeg:    item.isVeg,
      });
    }
  };

  // ── KOT mutation ───────────────────────────────────────────────────────────
  const placeKotMutation = useMutation({
    networkMode: 'always',
    mutationFn: async (data: {
      currentOrder: string | null;
      orderType: any;
      tableId: string | null;
      covers: number;
      isComplimentary: boolean;
      isSalesReturn: boolean;
      scheduledAt: Date | null;
      userId: string | undefined;
      cart: any[];
    }) => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (!data.currentOrder) {
        const payload = {
          type:           data.orderType,
          tableId:        data.tableId        ?? undefined,
          covers:         data.covers,
          isComplimentary: data.isComplimentary,
          isSalesReturn:   data.isSalesReturn,
          scheduledAt:    data.scheduledAt?.toISOString(),
          waiterId:       data.userId       ?? undefined,
          items: data.cart.map((i: any) => ({
            menuItemId:  i.id,
            quantity:    i.qty,
            notes:       i.notes,
            variationId: i.variationId ?? undefined,
          })),
        };

        if (isOffline) {
          const tempId = `OFFLINE-${Date.now()}`;
          const tempOrder = {
            id: tempId,
            orderNumber: `OFF-${Math.floor(Math.random() * 10000)}`,
            createdAt: new Date().toISOString(),
            ...payload,
            items: data.cart.map((i: any) => ({
              id: i.cartKey || String(Math.random()),
              menuItemId: i.id,
              name: i.name,
              quantity: i.qty,
              unitPrice: i.price,
              cgstRate: i.cgstRate,
              sgstRate: i.sgstRate,
              isVeg: i.isVeg,
              variationName: i.variationName,
              variationId: i.variationId,
              notes: i.notes,
              kdsStatus: 'pending'
            })),
            branchId: branchId || '',
            status: 'pending',
            grandTotal: Math.round(data.cart.reduce((s: number, i: any) => {
              const lineTotal = (i.price || 0) * (i.qty || 1);
              const gst = lineTotal * (((i.cgstRate || 0) + (i.sgstRate || 0)) / 100);
              return s + lineTotal + gst;
            }, 0)),
          };
          await saveOrderLocally(tempOrder);
          await enqueueSync({
            entityType: 'orders',
            entityId: tempId,
            operation: 'create',
            payload: { ...payload, isOfflineSync: true },
            branchId: branchId || '',
            tenantId: useAuthStore.getState().tenantId || '',
          });
          return tempOrder;
        }

        const order = await apiPost('/api/v1/orders', payload);
        return order.data;
      } else {
        const newItems = data.cart.filter((i: any) => !i.alreadySent);
        if (newItems.length === 0) {
          throw new Error(
            'No new items to send. Items already in this order have been sent to the kitchen.',
          );
        }
        
        const payload = {
          items: newItems.map((i: any) => ({
            menuItemId:  i.id,
            quantity:    i.qty,
            notes:       i.notes,
            variationId: i.variationId ?? undefined,
          })),
        };

        if (isOffline) {
          // If offline, update the local order cache so UI reflects the new items
          const db = await (await import('@/lib/offline')).getDb();
          const existingOrder = await db.get('orders', data.currentOrder);
          if (existingOrder) {
            const newOrderItems = newItems.map((i: any) => ({
              id: i.cartKey || String(Math.random()),
              menuItemId: i.id,
              name: i.name,
              quantity: i.qty,
              unitPrice: i.price,
              cgstRate: i.cgstRate,
              sgstRate: i.sgstRate,
              isVeg: i.isVeg,
              variationName: i.variationName,
              variationId: i.variationId,
              notes: i.notes,
              kdsStatus: 'pending'
            }));
            
            // Recalculate totals
            const updatedItems = [...(existingOrder.items || []), ...newOrderItems];
            const newGrandTotal = Math.round(updatedItems.reduce((s: number, i: any) => {
              const lineTotal = (i.unitPrice || 0) * (i.quantity || 1);
              const gst = lineTotal * (((i.cgstRate || 0) + (i.sgstRate || 0)) / 100);
              return s + lineTotal + gst;
            }, 0));
            
            await db.put('orders', {
              ...existingOrder,
              items: updatedItems,
              grandTotal: newGrandTotal
            });
          }

          await enqueueSync({
            entityType: `orders/${data.currentOrder}/items`,
            entityId: '',
            operation: 'create',
            payload: { ...payload, isOfflineSync: true },
            branchId: branchId || '',
            tenantId: useAuthStore.getState().tenantId || '',
          });
          return { id: data.currentOrder, _local: true };
        }

        return apiPost(`/api/v1/orders/${data.currentOrder}/items`, payload);
      }
    },
    onMutate: (variables) => {
      // Optimistically update the UI for instant feedback
      if (!variables.currentOrder) {
        resetPosState();
      } else {
        setCart(variables.cart.map(i => ({ ...i, alreadySent: true })));
      }
    },
    onSuccess: () => {
      toast.success('KOT placed successfully!');
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to send KOT'),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full relative">

      {/* ── Left: Menu ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Top bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          <OrderTypeSelector value={orderType} onChange={setOrderType} />

          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-400" />
            <input
              className="input pl-8"
              placeholder="Search items or short code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {orderType === 'dine_in' && (
            <button
              className={cn('btn-secondary', tableId && 'border-amber-500 text-amber-600 dark:text-amber-400')}
              onClick={() => setShowTablePicker(true)}
            >
              <UtensilsCrossed size={14} />
              {tableName || 'Table'}
            </button>
          )}

          {/* Open orders dropdown */}
          <div className="relative">
            <button
              className="btn-secondary"
              onClick={() => {
                if (!showOpenOrders) {
                  setIsOpeningDropdown(true);
                  setShowOpenOrders(true);
                  refetchOpenOrders().finally(() => setIsOpeningDropdown(false));
                } else {
                  setShowOpenOrders(false);
                }
              }}
            >
              <ClipboardList size={14} /> Orders <ChevronDown size={12} />
            </button>

            {showOpenOrders && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-400 uppercase">
                  Open Orders
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {isLoadingOpenOrders || isOpeningDropdown ? (
                    <div className="p-3"><ListRowSkeleton count={3} /></div>
                  ) : !openOrders?.length ? (
                    <div className="py-6 text-center text-slate-900 dark:text-slate-500 text-sm">No open orders</div>
                  ) : openOrders.map((o: any) => (
                    <button
                      key={o.id}
                      onClick={async () => {
                        if (loadingOrderId) return;
                        resetPosState();
                        setLoadingOrderId(o.id);
                        try {
                          let order = o;
                          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
                          
                          if (!isOffline && !o._local) {
                            const res = await apiFetch(`/api/v1/orders/${o.id}`);
                            order = res.data;
                          }
                          
                          setCurrentOrder(order.id);
                          setCurrentOrderNumber(order.orderNumber ?? null);
                          setTable(order.tableId ?? null, order.table?.name ?? null);
                          if (order.type) setOrderType(order.type);
                          
                          if (!order._local) {
                            setConfirmedGrandTotal(Number(order.grandTotal));
                          } else {
                            setConfirmedGrandTotal(null); // Fallback to live frontend math
                          }
                          
                          setCart(
                            (order.items || [])
                              .filter((item: any) => !item.isVoided)
                              .map((item: any) => ({
                                cartKey:       item.id || String(Math.random()),
                                id:            item.menuItemId,
                                name:          item.name || item.menuItem?.name || 'Item',
                                price:         Number(item.unitPrice || item.price || 0),
                                qty:           Number(item.quantity  || item.qty   || 1),
                                cgstRate:      Number(item.cgstRate  || 0),
                                sgstRate:      Number(item.sgstRate  || 0),
                                igstRate:      Number(item.igstRate  || 0),
                                cessRate:      Number(item.cessRate  || 0),
                                isVeg:         item.isVeg ?? true,
                                notes:         item.notes,
                                variationId:   item.variationId,
                                variationName: item.variationName,
                                alreadySent:   true,
                                kdsStatus:     item.kdsStatus ?? null,
                              })),
                          );
                          setShowOpenOrders(false);
                          toast.success(`Loaded order ${order.orderNumber}`);
                        } catch {
                          toast.error('Failed to load order');
                        } finally {
                          setLoadingOrderId(null);
                        }
                      }}
                      disabled={loadingOrderId !== null}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800/50 last:border-0 relative disabled:opacity-70',
                        currentOrder === o.id && 'bg-amber-100 dark:bg-amber-900/20',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
                          {o.orderNumber}
                          {loadingOrderId === o.id && <Loader2 size={14} className="animate-spin text-amber-500" />}
                        </span>
                        <span className="badge-slate capitalize text-xs">{o.status}</span>
                      </div>
                      <div className="text-xs text-slate-900 dark:text-slate-400 mt-0.5">
                        {o.table?.name || o.type?.replace('_', ' ')} · ₹{Number(o.grandTotal || 0).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none border-b border-slate-200 dark:border-slate-800">
          {isLoadingCategories ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse flex-shrink-0" />
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedCat(null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  !selectedCat ? 'bg-amber-500 text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white',
                )}
              >
                All Items
              </button>
              {categories?.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                    selectedCat === cat.id
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {isLoadingItems ? (
            <div className="col-span-full"><MenuGridSkeleton count={8} /></div>
          ) : filteredItems?.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-900 dark:text-slate-500">
              <Search size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No items found</p>
            </div>
          ) : filteredItems?.map((item: any) => {
            const activeVars = (item.variations || []).filter((v: any) => v.isActive);
            const gstRate    = item.gstRate?.rate ?? 0;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="pos-item card-sm text-left hover:border-amber-500 active:scale-95 relative"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-xs font-medium text-slate-900 dark:text-white leading-tight line-clamp-2">
                    {item.name}
                  </span>
                  <span className={cn(
                    'mt-0.5 w-3 h-3 rounded-sm border flex-shrink-0',
                    item.isVeg ? 'border-emerald-500' : 'border-red-500',
                  )}>
                    <span className={cn(
                      'block w-1.5 h-1.5 rounded-full m-0.5',
                      item.isVeg ? 'bg-emerald-500' : 'bg-red-500',
                    )} />
                  </span>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">₹{item.price}</div>
                {Number(gstRate) > 0 && (
                  <div className="text-xs text-slate-900 dark:text-slate-500">+{gstRate}% GST</div>
                )}
                {activeVars.length > 0 && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile FAB ────────────────────────────────────────────────────── */}
      {!showMobileCart && cart.length > 0 && (
        <div className="lg:hidden absolute bottom-4 left-4 right-4 z-40">
          <button 
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-between transition-transform active:scale-95"
          >
            <div className="flex items-center gap-2">
              <ShoppingCartIcon />
              <span>View Cart • {cart.length} item{cart.length > 1 ? 's' : ''}</span>
            </div>
            <span>₹{billingGrandTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* ── Right: Cart ───────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-shrink-0 flex flex-col bg-white dark:bg-slate-900",
        "lg:w-80 lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:static lg:flex",
        showMobileCart ? "fixed inset-0 z-50 w-full h-full" : "hidden"
      )}>

        {/* Cart header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showMobileCart && (
                <button 
                  onClick={() => setShowMobileCart(false)} 
                  className="lg:hidden p-1 -ml-1 text-slate-900 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                >
                  <X size={20} />
                </button>
              )}
              <h2 className="font-semibold text-slate-900 dark:text-white">Current Order</h2>
            </div>
            {cart.length > 0 && (
              <button onClick={resetPosState} className="text-xs text-red-600 dark:text-red-400 hover:text-red-300">
                Clear
              </button>
            )}
          </div>

          {/* Table tag */}
          {orderType === 'dine_in' && (
            <div className="mt-2 flex items-center gap-2">
              {tableId ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <UtensilsCrossed size={11} />
                  <span>{tableName}</span>
                  <button
                    onClick={() => setTable(null, null)}
                    className="ml-0.5 text-amber-600 dark:text-amber-400/60 hover:text-amber-600 dark:text-amber-300"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTablePicker(true)}
                  className="text-xs text-slate-900 dark:text-slate-500 hover:text-amber-600 dark:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <UtensilsCrossed size={11} /> Tap to assign table
                </button>
              )}
            </div>
          )}

          {/* Order number badge */}
          {currentOrder && currentOrderNumber && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                {currentOrderNumber}
              </span>
              <span className="text-xs text-slate-900 dark:text-slate-500">Editing existing order</span>
            </div>
          )}

          {/* Order flags */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {user?.role && ['manager', 'owner'].includes(user.role) && (
              <>
                <button
                  onClick={() => setIsComplimentary((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                    isComplimentary
                      ? 'bg-emerald-600/20 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-500 hover:border-slate-500',
                  )}
                >
                  <Gift size={11} /> Complimentary
                </button>
                <button
                  onClick={() => setIsSalesReturn((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                    isSalesReturn
                      ? 'bg-orange-600/20 border-orange-600 text-orange-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-500 hover:border-slate-500',
                  )}
                >
                  <RotateCcw size={11} /> Return
                </button>
              </>
            )}
            <button
              onClick={() => setShowAdvanceOrder(true)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                scheduledAt
                  ? 'bg-blue-600/20 border-blue-600 text-blue-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-500 hover:border-slate-500',
              )}
            >
              <Clock size={11} />
              {scheduledAt
                ? scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Advance'}
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingOrderId ? (
            <div className="pt-2"><ListRowSkeleton count={4} /></div>
          ) : cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm gap-2">
              <ShoppingCartIcon />
              <span>Add items to start an order</span>
            </div>
          ) : cart.map((item: any) => {
            const borderColor = !item.alreadySent
              ? 'border-amber-400 dark:border-amber-500/40'
              : item.kdsStatus === 'ready'     ? 'border-emerald-500/50'
              : item.kdsStatus === 'preparing' ? 'border-blue-500/40'
              : 'border-slate-200/50 dark:border-slate-700/50';

            return (
              <div
                key={item.cartKey}
                className={cn(
                  'rounded-lg p-3 border',
                  item.alreadySent ? 'bg-slate-100/50 dark:bg-slate-800/50' : 'bg-slate-50 dark:bg-slate-800',
                  borderColor,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-slate-900 dark:text-white leading-tight">{item.name}</span>
                      {item.variationName && (
                        <span className="text-xs text-blue-400">({item.variationName})</span>
                      )}
                    </div>

                    {item.alreadySent ? (
                      item.kdsStatus === 'ready' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          <CheckCircle2 size={11} /> Ready
                        </span>
                      ) : item.kdsStatus === 'preparing' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-400 mt-0.5">
                          <ChefHat size={11} /> Preparing...
                        </span>
                      ) : item.kdsStatus === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-900 dark:text-slate-400 mt-0.5">
                          <CheckCircle2 size={11} /> Served
                        </span>
                      ) : (
                        <span className="text-xs text-slate-900 dark:text-slate-500 mt-0.5 block">⏳ Sent to kitchen</span>
                      )
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5 block">
                        ● New — pending KOT
                      </span>
                    )}
                  </div>

                  {!item.alreadySent && (
                    <button
                      onClick={() => removeItem(item.cartKey)}
                      className="text-slate-900 dark:text-slate-500 hover:text-red-600 dark:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {!item.alreadySent && (
                      <button
                        onClick={() => updateQty(item.cartKey, item.qty - 1)}
                        className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                      >
                        <Minus size={10} />
                      </button>
                    )}
                    <span className="text-sm text-slate-900 dark:text-white w-4 text-center">{item.qty}</span>
                    {!item.alreadySent && (
                      <button
                        onClick={() => updateQty(item.cartKey, item.qty + 1)}
                        className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                      >
                        <Plus size={10} />
                      </button>
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium',
                    item.alreadySent ? 'text-slate-900 dark:text-slate-500' : 'text-amber-600 dark:text-amber-400',
                  )}>
                    ₹{(item.price * item.qty).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals + actions */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">

            {/* Discount */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <Tag size={13} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-slate-900 dark:text-slate-400 flex-1">Discount</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const amt = (subtotal * pct) / 100;
                      setDiscount(pct, amt);
                      setConfirmedGrandTotal(null);
                      if (currentOrder) serverApplyDiscount(pct, amt, currentOrder);
                    }}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded transition-colors',
                      discountPercent === pct
                        ? 'bg-emerald-600 text-slate-900 dark:text-white'
                        : 'text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white',
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-900 dark:text-slate-400">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 dark:text-slate-400">
                <span>GST</span>
                <span>₹{gstTotal.toFixed(2)}</span>
              </div>
              
              {(() => {
                const rawTotal = subtotal - discountAmount + gstTotal;
                const roundOff = Math.round(rawTotal) - rawTotal;
                if (Math.abs(roundOff) > 0.001) {
                  return (
                    <div className="flex justify-between text-slate-900 dark:text-slate-500 text-xs">
                      <span>Round-off</span>
                      <span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex justify-between text-slate-900 dark:text-white font-bold text-base border-t border-slate-300 dark:border-slate-700 pt-2">
                <span>Total</span>
                <span className={cn(isComplimentary && 'line-through text-slate-900 dark:text-slate-500')}>
                  ₹{billingGrandTotal.toFixed(2)}
                </span>
              </div>
              {isComplimentary && (
                <div className="text-right text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                  ₹0.00 (Complimentary)
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => placeKotMutation.mutate({ currentOrder, orderType, tableId, covers, isComplimentary, isSalesReturn, scheduledAt, userId: user?.id, cart })}
                disabled={placeKotMutation.isPending || cart.filter(i => !i.alreadySent).length === 0}
                className="btn-secondary text-xs"
              >
                <Printer size={12} />
                {placeKotMutation.isPending ? 'Sending...' : 'Send KOT'}
              </button>
              {user?.role !== 'waiter' && (
                <button 
                  onClick={handleOpenBilling} 
                  disabled={isBillingLoading}
                  className="btn-primary text-xs flex items-center justify-center gap-1.5"
                >
                  {isBillingLoading ? (
                    <><Loader2 size={12} className="animate-spin" /> Loading...</>
                  ) : (
                    <><CreditCard size={12} /> Bill</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {pickerItem && (
        <ItemPickerModal
          item={pickerItem}
          onClose={() => setPickerItem(null)}
          onAdd={(variationId, variationName, price, qty, notes) => {
            addItem({
              id:            pickerItem.id,
              name:          pickerItem.name,
              price,
              cgstRate:      pickerItem.cgstRate,
              sgstRate:      pickerItem.sgstRate,
              isVeg:         pickerItem.isVeg,
              variationId,
              variationName,
              qty,
              notes,
            });
          }}
        />
      )}

      {showAdvanceOrder && (
        <AdvanceOrderModal
          onClose={() => setShowAdvanceOrder(false)}
          onConfirm={(d) => setScheduledAt(d)}
        />
      )}

      {showBilling && (
        <BillingModal
          shiftId={shift?.id}
          grandTotal={isComplimentary ? 0 : billingGrandTotal}
          gstTotal={isComplimentary   ? 0 : gstTotal}
          subtotal={isComplimentary   ? 0 : subtotal}
          orderId={currentOrder}
          onClose={() => setShowBilling(false)}
          onSuccess={() => {
            setShowBilling(false);
            resetPosState();
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
            qc.invalidateQueries({ queryKey: ['tables'] });
          }}
        />
      )}

      {showTablePicker && (
        <TablePickerModal onClose={() => setShowTablePicker(false)} />
      )}
    </div>
  );
}

function ShoppingCartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9"  cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}