import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TaxRegime { COMPOSITION = 'composition', REGULAR = 'regular' }

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) slug: string;
  @Column({ nullable: true }) gstin: string;
  @Column({ nullable: true }) pan: string;
  @Column({ name: 'fssai_no', nullable: true }) fssaiNo: string;
  @Column({ name: 'address_line1', nullable: true, type: 'text' }) addressLine1: string;
  @Column({ name: 'address_line2', nullable: true, type: 'text' }) addressLine2: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) state: string;
  @Column({ name: 'state_code', nullable: true, length: 2 }) stateCode: string;
  @Column({ nullable: true }) pincode: string;
  @Column({ default: 'India' }) country: string;
  @Column() email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ name: 'logo_url', nullable: true, type: 'text' }) logoUrl: string;
  @Column({ name: 'tax_regime', type: 'enum', enum: TaxRegime, default: TaxRegime.REGULAR }) taxRegime: TaxRegime;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
