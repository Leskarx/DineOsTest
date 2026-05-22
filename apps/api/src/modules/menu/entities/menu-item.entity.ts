import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { MenuItemVariation } from './menu-item-variation.entity';

export enum ItemType { FOOD = 'food', BEVERAGE = 'beverage', ALCOHOL = 'alcohol', TOBACCO = 'tobacco', ACCOMMODATION = 'accommodation' }

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'category_id', nullable: true }) categoryId: string;
  @Column({ name: 'gst_rate_id', nullable: true }) gstRateId: string;
  @Column() name: string;
  @Column({ nullable: true, type: 'text' }) description: string;
  @Column({ name: 'short_code', nullable: true }) shortCode: string;
  @Column({ nullable: true }) sku: string;
  @Column({ nullable: true }) barcode: string;
  @Column({ name: 'image_url', nullable: true, type: 'text' }) imageUrl: string;
  @Column({ type: 'enum', enum: ItemType, default: ItemType.FOOD }) type: ItemType;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) price: number;
  @Column({ name: 'cost_price', type: 'numeric', precision: 10, scale: 2, nullable: true }) costPrice: number;
  @Column({ name: 'is_veg', default: true }) isVeg: boolean;
  @Column({ name: 'is_available', default: true }) isAvailable: boolean;
  @Column({ name: 'is_addon', default: false }) isAddon: boolean;
  @Column({ name: 'track_inventory', default: false }) trackInventory: boolean;
  @Column({ name: 'inventory_item_id', nullable: true }) inventoryItemId: string;
  @Column({ type: 'jsonb', default: [] }) tags: string[];
  @Column({ name: 'sort_order', type: 'smallint', default: 0 }) sortOrder: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  /** Size / weight variants — when present the POS shows a picker instead of adding base price */
  @OneToMany(() => MenuItemVariation, (v) => v.item, { cascade: true, eager: false })
  variations: MenuItemVariation[];
}
