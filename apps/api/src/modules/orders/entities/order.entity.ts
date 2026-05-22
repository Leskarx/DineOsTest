import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

import { OrderItem } from './order-item.entity';

export enum OrderType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
  DELIVERY = 'delivery',
  ROOM_SERVICE = 'room_service',
}

export enum OrderStatus {
  DRAFT = 'draft',
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  BILLED = 'billed',
  CANCELLED = 'cancelled',
  OPEN = 'open',
  VOID = 'void',
}

@Entity('orders')
@Index(['branchId', 'orderNumber'], { unique: true })
export class Order {
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
    name: 'table_id',
    type: 'uuid',
    nullable: true,
  })
  tableId: string | null;

  @Column({
    name: 'shift_id',
    type: 'uuid',
    nullable: true,
  })
  shiftId: string | null;

  @Column({
    name: 'order_number',
    type: 'varchar',
  })
  orderNumber: string;

  @Column({
    name: 'order_type',
    type: 'enum',
    enum: OrderType,
    default: OrderType.DINE_IN,
  })
  type: OrderType;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

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
    name: 'waiter_id',
    type: 'uuid',
    nullable: true,
  })
  waiterId: string | null;

  @Column({
    name: 'cashier_id',
    type: 'uuid',
    nullable: true,
  })
  cashierId: string | null;

  @Column({
    name: 'cover_count',
    type: 'smallint',
    default: 1,
  })
  covers: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @Column({
    name: 'kot_printed',
    type: 'boolean',
    default: false,
  })
  kotPrinted: boolean;

  @Column({
    name: 'bill_printed',
    type: 'boolean',
    default: false,
  })
  billPrinted: boolean;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
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
    name: 'discount_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discountPercent: number;

  @Column({
    name: 'taxable_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
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
    default: 0,
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

  /** Complimentary orders are tracked for revenue leakage reporting */
  @Column({
    name: 'is_complimentary',
    type: 'boolean',
    default: false,
  })
  isComplimentary: boolean;

  /** Sales return / refund order — reverses a previously billed order */
  @Column({
    name: 'is_sales_return',
    type: 'boolean',
    default: false,
  })
  isSalesReturn: boolean;

  /** Advance / scheduled order — fulfilled at a future date/time */
  @Column({
    name: 'scheduled_at',
    type: 'timestamp',
    nullable: true,
  })
  scheduledAt: Date | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  synced: boolean;

  @Column({
    name: 'offline_id',
    type: 'varchar',
    nullable: true,
  })
  offlineId: string | null;

  @Column({
    type: 'jsonb',
    default: {},
  })
  metadata: Record<string, any>;

  @Column({
    name: 'placed_at',
    type: 'timestamp',
    nullable: true,
  })
  placedAt: Date | null;

  @Column({
    name: 'served_at',
    type: 'timestamp',
    nullable: true,
  })
  servedAt: Date | null;

  @Column({
    name: 'billed_at',
    type: 'timestamp',
    nullable: true,
  })
  billedAt: Date | null;

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

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
  })
  items: OrderItem[];
}