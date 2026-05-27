import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

import { Payment } from './payment.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  VOID = 'void',
  REFUNDED = 'refunded',
}

export enum BillSource {
  POS = 'pos',
  HOTEL = 'hotel',
}

export enum GstType {
  CGST_SGST = 'cgst_sgst',
  IGST = 'igst',
  EXEMPT = 'exempt',
}

@Entity('bills')
@Index(['branchId', 'billNumber'], { unique: true })
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'tenant_id',
    type: 'uuid',
  })
  @Index()
  tenantId: string;

  @Column({
    name: 'branch_id',
    type: 'uuid',
  })
  @Index()
  branchId: string;

  @Column({
    name: 'order_id',
    type: 'uuid',
    nullable: true,
  })
  orderId: string | null;

  @Column({
    name: 'reservation_id',
    type: 'uuid',
    nullable: true,
  })
  reservationId: string | null;

  @Column({
    type: 'enum',
    enum: BillSource,
    default: BillSource.POS,
  })
  source: BillSource;

  @Column({
    name: 'shift_id',
    type: 'uuid',
    nullable: true,
  })
  shiftId: string | null;

  @Column({
    name: 'bill_number',
    type: 'varchar',
  })
  billNumber: string;

  @Column({
    name: 'invoice_number',
    type: 'varchar',
    nullable: true,
  })
  invoiceNumber: string | null;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.ISSUED,
  })
  status: InvoiceStatus;

  @Column({
    name: 'customer_name',
    type: 'varchar',
    nullable: true,
  })
  customerName: string | null;

  @Column({
    name: 'customer_phone',
    type: 'varchar',
    nullable: true,
  })
  customerPhone: string | null;

  @Column({
    name: 'customer_gstin',
    type: 'varchar',
    nullable: true,
  })
  customerGstin: string | null;

  @Column({
    name: 'customer_address',
    type: 'text',
    nullable: true,
  })
  customerAddress: string | null;

  @Column({
    name: 'supply_type',
    type: 'enum',
    enum: GstType,
    default: GstType.CGST_SGST,
  })
  supplyType: GstType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  subtotal: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    name: 'taxable_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  taxableAmount: number;

  @Column({
    name: 'cgst_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  cgstAmount: number;

  @Column({
    name: 'sgst_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sgstAmount: number;

  @Column({
    name: 'igst_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  igstAmount: number;

  @Column({
    name: 'cess_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  cessAmount: number;

  @Column({
    name: 'total_tax',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalTax: number;

  @Column({
    name: 'round_off',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  roundOff: number;

  @Column({
    name: 'grand_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  grandTotal: number;

  @Column({
    name: 'paid_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  paidAmount: number;

  @Column({
    name: 'change_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  changeAmount: number;

  @Column({
    name: 'gst_summary',
    type: 'jsonb',
    default: [],
  })
  gstSummary: any[];

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @Column({
    name: 'is_refunded',
    type: 'boolean',
    default: false,
  })
  isRefunded: boolean;

  @Column({
    name: 'refund_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  refundAmount: number;

  @Column({
    name: 'printed_count',
    type: 'smallint',
    default: 0,
  })
  printedCount: number;

  @Column({
    name: 'printed_at',
    type: 'timestamp',
    nullable: true,
  })
  printedAt: Date | null;

  @Column({
    name: 'issued_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  issuedAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
  })
  updatedAt: Date;

  @OneToMany(() => Payment, (p) => p.bill)
  payments: Payment[];
}