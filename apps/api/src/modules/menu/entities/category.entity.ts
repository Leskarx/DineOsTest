import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'parent_id', nullable: true }) parentId: string;
  @Column() name: string;
  @Column({ nullable: true, type: 'text' }) description: string;
  @Column({ name: 'image_url', nullable: true, type: 'text' }) imageUrl: string;
  @Column({ nullable: true, length: 7 }) color: string;
  @Column({ name: 'sort_order', type: 'smallint', default: 0 }) sortOrder: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
