import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('gst_rates')
export class GstRate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() name: string;
  @Column({ type: 'numeric', precision: 5, scale: 2 }) rate: number;
  @Column({ name: 'cgst_rate', type: 'numeric', precision: 5, scale: 2, nullable: true }) cgstRate: number;
  @Column({ name: 'sgst_rate', type: 'numeric', precision: 5, scale: 2, nullable: true }) sgstRate: number;
  @Column({ name: 'igst_rate', type: 'numeric', precision: 5, scale: 2, nullable: true }) igstRate: number;
  @Column({ name: 'cess_rate', type: 'numeric', precision: 5, scale: 2, default: 0 }) cessRate: number;
  @Column({ name: 'hsn_sac_code', nullable: true }) hsnSacCode: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
