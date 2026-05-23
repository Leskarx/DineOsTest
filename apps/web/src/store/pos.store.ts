import { create } from 'zustand';

export interface CartItem {
  /** Unique cart-line key: `${menuItemId}-${variationId ?? 'base'}` */
  cartKey: string;
  /** Menu item UUID — used as `menuItemId` in API calls */
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
}

type AddItemInput = Omit<CartItem, 'cartKey' | 'qty' | 'igstRate' | 'cessRate'> & {
  igstRate?: number;
  cessRate?: number;
  /** Directly set quantity (e.g. from picker). Defaults to 1. */
  qty?: number;
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

  addItem: (item: AddItemInput) => void;
  /** cartKey-based operations so variations of the same item are independent */
  updateQty: (cartKey: string, qty: number) => void;
  removeItem: (cartKey: string) => void;
  updateNotes: (cartKey: string, notes: string) => void;
  clearCart: () => void;
  setCurrentOrder: (id: string | null) => void;
  setOrderType: (type: PosState['orderType']) => void;
  setTable: (id: string | null, name: string | null) => void;
  setCovers: (n: number) => void;
  setDiscount: (percent: number, amount: number) => void;
  setCart: (items: CartItem[]) => void;
}

export const usePosStore = create<PosState>((set) => ({
  cart: [],
  currentOrder: null,
  orderType: 'dine_in',
  tableId: null,
  tableName: null,
  covers: 1,
  discountPercent: 0,
  discountAmount: 0,

  addItem: (item) =>
    set((state) => {
      const cartKey = `${item.id}-${item.variationId ?? 'base'}`;
      const existing = state.cart.find((c) => c.cartKey === cartKey);
      const incomingQty = item.qty ?? 1;
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.cartKey === cartKey ? { ...c, qty: c.qty + incomingQty } : c,
          ),
        };
      }
      return {
        cart: [
          ...state.cart,
          {
            ...item,
            cartKey,
            qty: incomingQty,
            igstRate: item.igstRate ?? 0,
            cessRate: item.cessRate ?? 0,
            variationId: item.variationId ?? null,
            variationName: item.variationName ?? null,
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

  removeItem: (cartKey) => set((state) => ({ cart: state.cart.filter((c) => c.cartKey !== cartKey) })),

  updateNotes: (cartKey, notes) =>
    set((state) => ({ cart: state.cart.map((c) => (c.cartKey === cartKey ? { ...c, notes } : c)) })),

  clearCart: () =>
    set({ cart: [], discountPercent: 0, discountAmount: 0 }),

  setCurrentOrder: (id) => set({ currentOrder: id }),
  setOrderType: (type) => set({ orderType: type }),
  setTable: (id, name) => set({ tableId: id, tableName: name }),
  setCovers: (n) => set({ covers: n }),
  setDiscount: (percent, amount) => set({ discountPercent: percent, discountAmount: amount }),
  setCart: (items) => set({ cart: items }),
}));
