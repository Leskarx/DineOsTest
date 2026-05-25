'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiFetch, apiPost } from '@/lib/api';
import { usePosStore } from '@/store/pos.store';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';
import { BillingModal } from '@/components/billing/BillingModal';
import { TablePickerModal } from '@/components/pos/TablePickerModal';
import { OrderTypeSelector } from '@/components/pos/OrderTypeSelector';
import {
  Search, Plus, Minus, Trash2, Printer, CreditCard, UtensilsCrossed,
  Tag, ChevronDown, ClipboardList, X, Gift, RotateCcw, Clock, CheckCircle2, ChefHat,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─── Variation / Item Picker Modal ─────────────────────────────────────── */
interface Variation { id: string; name: string; price: number; }
interface PickerItem {
  id: string; name: string; price: number;
  cgstRate: number; sgstRate: number; isVeg: boolean;
  variations: Variation[];
}

function ItemPickerModal({
  item,
  onClose,
  onAdd,
}: {
  item: PickerItem;
  onClose: () => void;
  onAdd: (variationId: string | null, variationName: string | null, price: number, qty: number, notes: string) => void;
}) {
  const [selectedVar, setSelectedVar] = useState<Variation | null>(
    item.variations.length > 0 ? item.variations[0] : null,
  );
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const effectivePrice = selectedVar ? selectedVar.price : item.price;

  const handleSave = () => {
    if (qty < 1) return;
    onAdd(selectedVar?.id ?? null, selectedVar?.name ?? null, effectivePrice, qty, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white">{item.name}</h3>
            <span className="text-amber-400 text-sm font-semibold">₹{effectivePrice.toFixed(2)}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Variations */}
          {item.variations.length > 0 && (
            <div>
              <label className="label mb-2">Variation</label>
              <div className="flex flex-wrap gap-2">
                {item.variations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVar(v)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-center min-w-[80px]',
                      selectedVar?.id === v.id
                        ? 'bg-amber-500 border-amber-500 text-slate-900'
                        : 'border-slate-600 text-slate-300 hover:border-amber-500',
                    )}
                  >
                    <div>{v.name}</div>
                    <div className="text-xs font-bold mt-0.5">₹{v.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="label mb-2">Quantity</label>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 flex-1">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                >
                  <Minus size={12} />
                </button>
                <input
                  className="flex-1 text-center bg-transparent text-white font-bold text-lg outline-none w-12"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            {/* Quick quantity presets */}
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(n)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    qty === n ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white',
                  )}
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label mb-1">Special Instructions (optional)</label>
            <input
              className="input text-sm"
              placeholder="e.g. Extra spicy, no onion..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1">
            Add to Order — ₹{(effectivePrice * qty).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Advance Order Time Picker ──────────────────────────────────────────── */
function AdvanceOrderModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [dt, setDt] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Schedule Advance Order</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>
        <div>
          <label className="label">Pickup / Delivery Date & Time</label>
          <input
            className="input"
            type="datetime-local"
            value={dt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setDt(e.target.value)}
          />
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

/* ─── Main POS Page ──────────────────────────────────────────────────────── */
export default function PosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showBilling, setShowBilling] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showOpenOrders, setShowOpenOrders] = useState(false);
  const [pickerItem, setPickerItem] = useState<PickerItem | null>(null);
  const [showAdvanceOrder, setShowAdvanceOrder] = useState(false);

  // Order-level flags
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [isSalesReturn, setIsSalesReturn] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<string | null>(null);

  const { user, branchId } = useAuthStore();
  
  const { data: shift } = useQuery({
    queryKey: ['current-shift', branchId],
    queryFn: () => apiFetch('/api/v1/shifts/current').then((r) => r.data).catch(() => null),
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
  }, [clearCart, setCurrentOrder, setDiscount, setTable]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/api/v1/menu/categories').then((r) => r.data),
  });
  const { data: items } = useQuery({
    queryKey: ['menuItems', selectedCat],
    queryFn: () => apiFetch(`/api/v1/menu/items${selectedCat ? `?categoryId=${selectedCat}` : ''}`).then((r) => r.data),
  });
  const { data: openOrders, refetch: refetchOpenOrders } = useQuery({
    queryKey: ['open-orders-pos'],
    queryFn: () => apiFetch('/api/v1/orders?status=draft,placed,confirmed,preparing,ready,served&limit=50').then((r) => r.data),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Refresh open orders list when the dropdown is opened
  useEffect(() => {
    if (showOpenOrders) refetchOpenOrders();
  }, [showOpenOrders, refetchOpenOrders]);

  // ── Real-time: refresh open orders list on any order event ──────────────
  const handleOrderEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
  }, [qc]);

  useSocket('order:created', handleOrderEvent);
  useSocket('order:itemsAdded', handleOrderEvent);
  useSocket('order:statusChanged', handleOrderEvent);

  // ── Real-time: update kdsStatus of existing cart items (NEVER replace cart) ──
  const handleKdsChange = useCallback((payload: any) => {
    qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
    const store = usePosStore.getState();
    const activeOrderId = store.currentOrder;
    if (!payload?.orderId || !activeOrderId || activeOrderId !== payload.orderId) return;

    // Instantly update the specific item's kdsStatus using the socket payload
    let changed = false;
    const currentCart = store.cart;
    const updatedCart = currentCart.map((c: any) => {
      // payload.itemId is the database UUID, which now perfectly matches cartKey for alreadySent items
      if (c.alreadySent && c.cartKey === payload.itemId && c.kdsStatus !== payload.status) {
        changed = true;
        return { ...c, kdsStatus: payload.status };
      }
      return c;
    });

    if (changed) store.setCart(updatedCart);
  }, [qc]);

  useSocket('kds:itemStatusChanged', handleKdsChange);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i: any) => i.name.toLowerCase().includes(q) || i.shortCode?.toLowerCase().includes(q),
    );
  }, [items, search]);

  const subtotal = cart.reduce((s: number, i: any) => s + i.price * i.qty, 0);
  const taxableAmount = subtotal - discountAmount;
  const gstTotal = cart.reduce((s: number, i: any) => {
    const price = Number(i.price || 0);
    const qty = Number(i.qty || 0);

    const cgst = Number(i.cgstRate || 0);
    const sgst = Number(i.sgstRate || 0);

    const lineSubtotal = price * qty;

    const lineDiscounted =
      lineSubtotal * (1 - Number(discountPercent || 0) / 100);

    const gstRate = (cgst + sgst) / 100;

    return s + gstRate * lineDiscounted;
  }, 0);
  const grandTotal = taxableAmount + gstTotal;

  const serverApplyDiscount = async (pct: number, amt: number, orderId: string) => {
    try {
      await api.patch(`/api/v1/orders/${orderId}/discount`, { discountPercent: pct, discountAmount: amt });
    } catch {
      toast.error('Could not apply discount on server');
    }
  };

  /** When an item tile is clicked: show picker if it has variations, else add directly */
  const handleItemClick = (item: any) => {
    const activeVariations = (item.variations || []).filter((v: any) => v.isActive);
    if (activeVariations.length > 0) {
      setPickerItem({ ...item, variations: activeVariations });
    } else {
      const gstRate = Number(item.gstRate || 0);

      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),

        cgstRate: Number(item.cgstRate ?? gstRate / 2),
        sgstRate: Number(item.sgstRate ?? gstRate / 2),

        isVeg: item.isVeg,
      });
    }
  };

  const placeKotMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrder) {
        // New order — send all cart items
        const order = await apiPost('/api/v1/orders', {
          type: orderType,
          tableId: tableId ?? undefined,
          covers,
          isComplimentary,
          isSalesReturn,
          scheduledAt: scheduledAt?.toISOString(),
          items: cart.map((i: any) => ({
            menuItemId: i.id,
            quantity: i.qty,
            notes: i.notes,
            variationId: i.variationId ?? undefined,
          }))
        });
        return order.data;
      } else {
        // Existing order — only send items that are NEW (not alreadySent)
        const newItems = cart.filter((i: any) => !i.alreadySent);
        if (newItems.length === 0) {
          throw new Error('No new items to send. The items already in this order have been sent to the kitchen.');
        }
        return apiPost(`/api/v1/orders/${currentOrder}/items`, {
          items: newItems.map((i: any) => ({
            menuItemId: i.id,
            quantity: i.qty,
            notes: i.notes,
            variationId: i.variationId ?? undefined,
          }))
        });
      }
    },
    onSuccess: () => {
      toast.success('KOT sent to kitchen!');
      resetPosState();
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['open-orders-pos'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to send KOT'),
  });

  return (
    <div className="flex h-full">
      {/* ── Left: Menu ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 flex-wrap">
          <OrderTypeSelector value={orderType} onChange={setOrderType} />
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8"
              placeholder="Search items or short code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {orderType === 'dine_in' && (
            <button
              className={cn('btn-secondary', tableId && 'border-amber-500 text-amber-400')}
              onClick={() => setShowTablePicker(true)}
            >
              <UtensilsCrossed size={14} />
              {tableName || 'Table'}
            </button>
          )}
          <div className="relative">
            <button className="btn-secondary" onClick={() => setShowOpenOrders((s) => !s)}>
              <ClipboardList size={14} /> Orders <ChevronDown size={12} />
            </button>
            {showOpenOrders && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">Open Orders</div>
                <div className="max-h-64 overflow-y-auto">
                  {!openOrders?.length ? (
                    <div className="py-6 text-center text-slate-500 text-sm">No open orders</div>
                  ) : openOrders.map((o: any) => (
                    <button
                      key={o.id}
                      onClick={async () => {
                        try {
                          const res = await apiFetch(`/api/v1/orders/${o.id}`);
                          const order = res.data;

                          // Reset everything first so switching orders gives a clean slate
                          resetPosState();
                          setCurrentOrder(order.id);
                          setCurrentOrderNumber(order.orderNumber ?? null);
                          setTable(order.tableId ?? null, order.table?.name ?? null);
                          if (order.type) setOrderType(order.type);

                          // Mark all loaded items as alreadySent so KOT only sends truly new ones
                          setCart(
                            (order.items || []).filter((item: any) => !item.isVoided).map((item: any) => ({
                              cartKey: item.id, // Use unique DB ID for already sent items
                              id: item.menuItemId,
                              name: item.name,
                              price: Number(item.unitPrice || item.price || 0),
                              qty: Number(item.quantity || item.qty || 1),
                              cgstRate: Number(item.cgstRate || 0),
                              sgstRate: Number(item.sgstRate || 0),
                              igstRate: Number(item.igstRate || 0),
                              cessRate: Number(item.cessRate || 0),
                              isVeg: item.isVeg ?? true,
                              notes: item.notes,
                              variationId: item.variationId,
                              variationName: item.variationName,
                              alreadySent: true, // already in the kitchen — don't re-send
                              kdsStatus: item.kdsStatus ?? null,
                            }))
                          );

                          setShowOpenOrders(false);

                          toast.success(`Loaded order ${o.orderNumber}`);
                        } catch {
                          toast.error('Failed to load order');
                        }
                      }}
                      className={cn('w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0', currentOrder === o.id && 'bg-amber-900/20')}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-amber-400 text-sm font-medium">{o.orderNumber}</span>
                        <span className="badge-slate capitalize text-xs">{o.status}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {o.table?.name || o.type?.replace('_', ' ')} · ₹{Number(o.grandTotal || 0).toFixed(0)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none border-b border-slate-800">
          <button
            onClick={() => setSelectedCat(null)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors', !selectedCat ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white')}
          >
            All Items
          </button>
          {categories?.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors', selectedCat === cat.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white')}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {filteredItems?.map((item: any) => {
            const activeVars = (item.variations || []).filter((v: any) => v.isActive);
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="pos-item card-sm text-left hover:border-amber-500 active:scale-95 relative"
              >
                {/* Veg/Non-veg dot */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-xs font-medium text-white leading-tight line-clamp-2">{item.name}</span>
                  <span className={cn('mt-0.5 w-3 h-3 rounded-sm border flex-shrink-0', item.isVeg ? 'border-emerald-500' : 'border-red-500')}>
                    <span className={cn('block w-1.5 h-1.5 rounded-full m-0.5', item.isVeg ? 'bg-emerald-500' : 'bg-red-500')} />
                  </span>
                </div>
                <div className="text-xs text-amber-400 font-semibold">₹{item.price}</div>
                {item.gstRate > 0 && <div className="text-xs text-slate-500">+{item.gstRate}% GST</div>}
                {/* Variation indicator */}
                {activeVars.length > 0 && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400" title={`${activeVars.length} sizes`} />
                )}
              </button>
            );
          })}
          {filteredItems?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500">
              <Search size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ──────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-800 bg-slate-900">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Current Order</h2>
            {cart.length > 0 && <button onClick={resetPosState} className="text-xs text-red-400 hover:text-red-300">Clear</button>}
          </div>

          {/* Table tag */}
          {orderType === 'dine_in' && (
            <div className="mt-2 flex items-center gap-2">
              {tableId ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                  <UtensilsCrossed size={11} />
                  <span>{tableName}</span>
                  <button onClick={() => setTable(null, null)} className="ml-0.5 text-amber-400/60 hover:text-amber-300"><X size={10} /></button>
                </div>
              ) : (
                <button onClick={() => setShowTablePicker(true)} className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                  <UtensilsCrossed size={11} /> Tap to assign table
                </button>
              )}
            </div>
          )}
          {currentOrder && currentOrderNumber && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                {currentOrderNumber}
              </span>
              <span className="text-xs text-slate-500">Editing existing order</span>
            </div>
          )}

          {/* Order type flags */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {user?.role && ['manager', 'owner'].includes(user.role) && (
              <>
                <button
                  onClick={() => setIsComplimentary((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                    isComplimentary
                      ? 'bg-emerald-600/20 border-emerald-600 text-emerald-400'
                      : 'border-slate-700 text-slate-500 hover:border-slate-500',
                  )}
                  title="Mark as complimentary (free)"
                >
                  <Gift size={11} /> Complimentary
                </button>
                <button
                  onClick={() => setIsSalesReturn((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                    isSalesReturn
                      ? 'bg-orange-600/20 border-orange-600 text-orange-400'
                      : 'border-slate-700 text-slate-500 hover:border-slate-500',
                  )}
                  title="Sales return / refund"
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
                  : 'border-slate-700 text-slate-500 hover:border-slate-500',
              )}
              title="Schedule for later"
            >
              <Clock size={11} />
              {scheduledAt
                ? scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Advance'}
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm gap-2">
              <ShoppingCartIcon />
              <span>Add items to start an order</span>
            </div>
          ) : cart.map((item: any) => {
            const borderColor = !item.alreadySent
              ? 'border-amber-500/40'
              : item.kdsStatus === 'ready'
              ? 'border-emerald-500/50'
              : item.kdsStatus === 'preparing'
              ? 'border-blue-500/40'
              : 'border-slate-700/50';

            return (
            <div key={item.cartKey} className={cn("rounded-lg p-3 border", item.alreadySent ? "bg-slate-800/50" : "bg-slate-800", borderColor)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm text-white leading-tight">{item.name}</span>
                    {item.variationName && (
                      <span className="text-xs text-blue-400">({item.variationName})</span>
                    )}
                  </div>
                  {/* KDS status badge */}
                  {item.alreadySent ? (
                    item.kdsStatus === 'ready' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-0.5">
                        <CheckCircle2 size={11} /> Ready — pick up from kitchen
                      </span>
                    ) : item.kdsStatus === 'preparing' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-400 mt-0.5">
                        <ChefHat size={11} /> Preparing...
                      </span>
                    ) : item.kdsStatus === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <CheckCircle2 size={11} /> Served
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 mt-0.5 block">⏳ Sent — waiting for kitchen</span>
                    )
                  ) : (
                    <span className="text-xs text-amber-400 font-semibold mt-0.5 block">● New — pending KOT</span>
                  )}
                </div>
                {!item.alreadySent && (
                  <button onClick={() => removeItem(item.cartKey)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {!item.alreadySent && (
                    <button onClick={() => updateQty(item.cartKey, item.qty - 1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                      <Minus size={10} />
                    </button>
                  )}
                  <span className="text-sm text-white w-4 text-center">{item.qty}</span>
                  {!item.alreadySent && (
                    <button onClick={() => updateQty(item.cartKey, item.qty + 1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                      <Plus size={10} />
                    </button>
                  )}
                </div>
                <span className={cn("text-sm font-medium", item.alreadySent ? "text-slate-500" : "text-amber-400")}>₹{(item.price * item.qty).toFixed(2)}</span>
              </div>
            </div>
            );
          })}
        </div>

        {/* Totals + Actions */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-800 space-y-3">
            {/* Discount quick-picks */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
              <Tag size={13} className="text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-slate-400 flex-1">Discount</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const amt = (subtotal * pct) / 100;
                      setDiscount(pct, amt);
                      if (currentOrder) serverApplyDiscount(pct, amt, currentOrder);
                    }}
                    className={cn('text-xs px-1.5 py-0.5 rounded transition-colors', discountPercent === pct ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white')}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount ({discountPercent}%)</span><span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2">
                <span>Total</span>
                <span className={cn(isComplimentary && 'line-through text-slate-500')}>₹{grandTotal.toFixed(2)}</span>
              </div>
              {isComplimentary && <div className="text-right text-emerald-400 text-sm font-bold">₹0.00 (Complimentary)</div>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => placeKotMutation.mutate()} disabled={placeKotMutation.isPending} className="btn-secondary text-xs">
                <Printer size={12} /> {placeKotMutation.isPending ? 'Sending...' : 'Send KOT'}
              </button>
              {user?.role !== 'waiter' && (
                <button onClick={() => {
                  if (user?.role === 'cashier' && !shift?.id) {
                    toast.error('You must open a shift first!');
                    return;
                  }
                  setShowBilling(true);
                }} className="btn-primary text-xs">
                  <CreditCard size={12} /> Bill
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {pickerItem && (
        <ItemPickerModal
          item={pickerItem}
          onClose={() => setPickerItem(null)}
          onAdd={(variationId, variationName, price, qty, notes) => {
            addItem({
              id: pickerItem.id,
              name: pickerItem.name,
              price,
              cgstRate: Number(pickerItem.cgstRate || 0),
              sgstRate: Number(pickerItem.sgstRate || 0),
              isVeg: pickerItem.isVeg,
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
          grandTotal={isComplimentary ? 0 : grandTotal}
          gstTotal={isComplimentary ? 0 : gstTotal}
          subtotal={isComplimentary ? 0 : subtotal}
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
      {showTablePicker && <TablePickerModal onClose={() => setShowTablePicker(false)} />}
    </div>
  );
}

function ShoppingCartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
