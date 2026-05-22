import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TableStatus { AVAILABLE = 'available', OCCUPIED = 'occupied', RESERVED = 'reserved', CLEANING = 'cleaning' }

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'branch_id' }) @Index() branchId: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'section_id', nullable: true }) sectionId: string;
  @Column({ name: 'table_number' }) name: string;
  @Column({ type: 'smallint', default: 4 }) capacity: number;
  @Column({ type: 'enum', enum: TableStatus, default: TableStatus.AVAILABLE }) status: TableStatus;
  @Column({ name: 'qr_code', nullable: true, type: 'text' }) qrCode: string;
  @Column({ name: 'pos_x', nullable: true }) positionX: number;
  @Column({ name: 'pos_y', nullable: true }) positionY: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
