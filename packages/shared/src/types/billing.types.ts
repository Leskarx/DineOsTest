export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'credit' | 'complimentary';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void' | 'refunded';
export type SupplyType = 'cgst_sgst' | 'igst' | 'exempt';

export interface GstSummaryRow {
  gstRate: number;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalTax: string;
}

export interface Bill {
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  billNumber: string;
  invoiceNumber?: string;
  status: InvoiceStatus;
  supplyType: SupplyType;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  gstSummary: GstSummaryRow[];
  issuedAt: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
  cardLast4?: string;
  upiId?: string;
}
