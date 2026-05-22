import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id' }) branchId: string;
  // category is a simple varchar label in the DB (not a FK)
  @Column({ nullable: true }) category: string;
  @Column() name: string;
  @Column({ nullable: true }) sku: string;
  // unit is a simple varchar in the DB (e.g. 'kg', 'piece')
  @Column({ default: 'piece' }) unit: string;
  @Column({ name: 'current_stock', type: 'numeric', precision: 12, scale: 3, default: 0 }) currentStock: number;
  @Column({ name: 'reorder_level', type: 'numeric', precision: 12, scale: 3, default: 0 }) reorderLevel: number;
  @Column({ name: 'min_stock_level', type: 'numeric', precision: 12, scale: 3, default: 0 }) minStockLevel: number;
  @Column({ name: 'cost_price', type: 'numeric', precision: 10, scale: 2, default: 0 }) costPrice: number;
  @Column({ name: 'avg_cost', type: 'numeric', precision: 10, scale: 2, default: 0 }) averageCost: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
