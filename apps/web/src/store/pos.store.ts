import { create } from 'zustand';

export interface CartItem {
  cartKey: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  isVeg: boolean;
  notes?: string;
  variationId?: string | null;
  variationName?: string | null;
  alreadySent?: boolean;
  kdsStatus?: 'pending' | 'preparing' | 'ready' | 'completed' | null;
  kotRound?: number | null;
}

type AddItemInput = Omit<CartItem, 'cartKey' | 'qty' | 'igstRate' | 'cessRate' | 'alreadySent'> & {
  igstRate?: number;
  cessRate?: number;
  qty?: number;
  alreadySent?: boolean;
  kotRound?: number | null;
};

interface PosState {
  cart: CartItem[];
  currentOrder: string | null;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
  tableId: string | null;
  tableName: string | null;
  covers: number;
  discountPercent: number;
  discountAmount: number;

  // ── Delivery fields — persisted in store so they survive navigation ──
  deliveryPhone:   string;
  deliveryName:    string;
  deliveryAddress: string;
  /** 'cod' = collect on delivery | 'prepaid' = paid at order time */
  deliveryPaymentType: 'cod' | 'prepaid';

  addItem:        (item: AddItemInput) => void;
  updateQty:      (cartKey: string, qty: number) => void;
  removeItem:     (cartKey: string) => void;
  updateNotes:    (cartKey: string, notes: string) => void;
  clearCart:      () => void;
  setCurrentOrder:(id: string | null) => void;
  setOrderType:   (type: PosState['orderType']) => void;
  setTable:       (id: string | null, name: string | null) => void;
  setCovers:      (n: number) => void;
  setDiscount:    (percent: number, amount: number) => void;
  setCart:        (items: CartItem[]) => void;

  // ── Delivery setters ──
  setDeliveryPhone:       (v: string) => void;
  setDeliveryName:        (v: string) => void;
  setDeliveryAddress:     (v: string) => void;
  setDeliveryPaymentType: (v: 'cod' | 'prepaid') => void;
  clearDeliveryFields:    () => void;
}

export const usePosStore = create<PosState>((set) => ({
  cart:            [],
  currentOrder:    null,
  orderType:       'dine_in',
  tableId:         null,
  tableName:       null,
  covers:          1,
  discountPercent: 0,
  discountAmount:  0,

  // Delivery defaults
  deliveryPhone:       '',
  deliveryName:        '',
  deliveryAddress:     '',
  deliveryPaymentType: 'cod',

  addItem: (item) =>
    set((state) => {
      const cartKey  = `${item.id}-${item.variationId ?? 'base'}`;
      const existing = state.cart.find((c) => c.cartKey === cartKey);
      const incomingQty = item.qty ?? 1;

      if (existing) {
        if (!existing.alreadySent) {
          return {
            cart: state.cart.map((c) =>
              c.cartKey === cartKey ? { ...c, qty: c.qty + incomingQty } : c,
            ),
          };
        }
        const newKey      = `${cartKey}-new-${Date.now()}`;
        const newEntry    = state.cart.find((c) => c.cartKey.startsWith(`${cartKey}-new-`));
        if (newEntry) {
          return {
            cart: state.cart.map((c) =>
              c.cartKey.startsWith(`${cartKey}-new-`) ? { ...c, qty: c.qty + incomingQty } : c,
            ),
          };
        }
        return {
          cart: [
            ...state.cart,
            {
              ...item,
              cartKey:       newKey,
              qty:           incomingQty,
              igstRate:      item.igstRate  ?? 0,
              cessRate:      item.cessRate  ?? 0,
              variationId:   item.variationId   ?? null,
              variationName: item.variationName ?? null,
              alreadySent:   false,
              kotRound:      null,
            },
          ],
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            ...item,
            cartKey,
            qty:           incomingQty,
            igstRate:      item.igstRate  ?? 0,
            cessRate:      item.cessRate  ?? 0,
            variationId:   item.variationId   ?? null,
            variationName: item.variationName ?? null,
            alreadySent:   item.alreadySent ?? false,
            kotRound:      item.kotRound   ?? null,
          },
        ],
      };
    }),

  updateQty: (cartKey, qty) =>
    set((state) => ({
      cart: qty <= 0
        ? state.cart.filter((c) => c.cartKey !== cartKey)
        : state.cart.map((c) => (c.cartKey === cartKey ? { ...c, qty } : c)),
    })),

  removeItem:  (cartKey) => set((state) => ({ cart: state.cart.filter((c) => c.cartKey !== cartKey) })),
  updateNotes: (cartKey, notes) =>
    set((state) => ({ cart: state.cart.map((c) => (c.cartKey === cartKey ? { ...c, notes } : c)) })),

  clearCart: () => set({ cart: [], discountPercent: 0, discountAmount: 0 }),

  setCurrentOrder: (id)         => set({ currentOrder: id }),
  setOrderType:    (type)       => set({ orderType: type }),
  setTable:        (id, name)   => set({ tableId: id, tableName: name }),
  setCovers:       (n)          => set({ covers: n }),
  setDiscount:     (pct, amt)   => set({ discountPercent: pct, discountAmount: amt }),
  setCart:         (items)      => set({ cart: items }),

  // Delivery setters
  setDeliveryPhone:       (v) => set({ deliveryPhone:       v }),
  setDeliveryName:        (v) => set({ deliveryName:        v }),
  setDeliveryAddress:     (v) => set({ deliveryAddress:     v }),
  setDeliveryPaymentType: (v) => set({ deliveryPaymentType: v }),
  clearDeliveryFields:    ()  => set({
    deliveryPhone:       '',
    deliveryName:        '',
    deliveryAddress:     '',
    deliveryPaymentType: 'cod',
  }),
}));