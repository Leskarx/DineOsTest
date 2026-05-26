import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum TransactionType {
  PURCHASE   = 'purchase',
  SALE       = 'sale',
  WASTE      = 'waste',
  ADJUSTMENT = 'adjustment',
  OPENING    = 'opening',
  TRANSFER   = 'transfer',
}

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) tenantId: string;

  @Column({ name: 'branch_id' }) @Index() branchId: string;

  @Column({ name: 'inventory_item_id' }) @Index() inventoryItemId: string;

  @Column({ type: 'enum', enum: TransactionType }) type: TransactionType;

  @Column({ type: 'numeric', precision: 12, scale: 3 }) quantity: number;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 12, scale: 4, default: 0 }) unitCost: number;

  @Column({ name: 'total_cost', type: 'numeric', precision: 12, scale: 2, default: 0 }) totalCost: number;

  @Column({ name: 'balance_after', type: 'numeric', precision: 12, scale: 3 }) balanceAfter: number;

  @Column({ name: 'reference_type', nullable: true }) referenceType: string;

  @Column({ name: 'reference_id', nullable: true }) referenceId: string;

  // ← REMOVED: po_id    — does not exist in DB
  // ← REMOVED: order_id — does not exist in DB

  @Column({ nullable: true, type: 'text' }) notes: string;

  @Column({ name: 'created_by', nullable: true }) createdBy: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}