import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';

/**
 * A size / weight variant of a menu item.
 * e.g.  250 Gram → ₹70 | 500 Gram → ₹140 | 1 Kg → ₹300
 *
 * When a menu item has one or more active variations the POS shows a
 * variation-picker modal instead of directly adding the base price to cart.
 */
@Entity('menu_item_variations')
export class MenuItemVariation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'menu_item_id' }) @Index() menuItemId: string;
  @ManyToOne(() => MenuItem, (item) => item.variations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_item_id' }) item: MenuItem;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;

  /** Display name shown in picker (e.g. "250 Gram", "Regular", "Large") */
  @Column() name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 }) price: number;

  @Column({ name: 'cost_price', type: 'numeric', precision: 10, scale: 2, nullable: true })
  costPrice: number | null;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 }) sortOrder: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
