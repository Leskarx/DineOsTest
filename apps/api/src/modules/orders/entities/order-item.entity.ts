import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Order } from './order.entity';

export enum KdsStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  PREPARING = 'preparing',
  READY = 'ready',
  COMPLETED = 'completed',
  RECALLED = 'recalled',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index()
  orderId: string;

  @ManyToOne(() => Order, (o) => o.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({
    name: 'menu_item_id',
    type: 'uuid',
    nullable: true,
  })
  menuItemId: string | null;

  /** Variation selected at POS (e.g. "500 Gram") — null when item has no variants */
  @Column({
    name: 'variation_id',
    type: 'uuid',
    nullable: true,
  })
  variationId: string | null;

  @Column({
    name: 'variation_name',
    type: 'varchar',
    nullable: true,
  })
  variationName: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  sku: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  unitPrice: number;

  @Column({
    name: 'cost_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  costPrice: number | null;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    name: 'taxable_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  taxableAmount: number;

  @Column({
    name: 'gst_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  gstRate: number;

  @Column({
    name: 'cgst_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  cgstRate: number;

  @Column({
    name: 'sgst_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  sgstRate: number;

  @Column({
    name: 'igst_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  igstRate: number;

  @Column({
    name: 'cgst_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  cgstAmount: number;

  @Column({
    name: 'sgst_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  sgstAmount: number;

  @Column({
    name: 'igst_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  igstAmount: number;

  @Column({
    name: 'cess_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  cessAmount: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  lineTotal: number;

  @Column({
    name: 'is_veg',
    type: 'boolean',
    default: true,
  })
  isVeg: boolean;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @Column({
    name: 'kds_status',
    type: 'enum',
    enum: KdsStatus,
    default: KdsStatus.PENDING,
  })
  kdsStatus: KdsStatus;

  @Column({
    name: 'kds_acknowledged_at',
    type: 'timestamp',
    nullable: true,
  })
  kdsAcknowledgedAt: Date | null;

  @Column({
    name: 'kds_ready_at',
    type: 'timestamp',
    nullable: true,
  })
  kdsReadyAt: Date | null;

  @Column({
    name: 'is_voided',
    type: 'boolean',
    default: false,
  })
  isVoided: boolean;

  @Column({
    name: 'void_reason',
    type: 'text',
    nullable: true,
  })
  voidReason: string | null;

  @Column({
    name: 'sort_order',
    type: 'smallint',
    default: 0,
  })
  sortOrder: number;

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
}