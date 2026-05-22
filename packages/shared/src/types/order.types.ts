export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'room_service';
export type OrderStatus = 'draft' | 'placed' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'billed' | 'cancelled';
export type KdsStatus = 'pending' | 'acknowledged' | 'preparing' | 'ready' | 'recalled';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  lineTotal: number;
  isVeg: boolean;
  notes?: string;
  kdsStatus: KdsStatus;
  isVoided: boolean;
}

export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  tableId?: string;
  shiftId?: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName?: string;
  customerPhone?: string;
  covers: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderPayload {
  type: OrderType;
  tableId?: string;
  covers?: number;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    notes?: string;
  }>;
}
