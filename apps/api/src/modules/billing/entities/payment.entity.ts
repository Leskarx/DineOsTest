import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Bill } from './bill.entity';

export enum PaymentMethod { CASH = 'cash', CARD = 'card', UPI = 'upi', WALLET = 'wallet', CREDIT = 'credit', COMPLIMENTARY = 'complimentary' }

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'branch_id' }) @Index() branchId: string;
  @Column({ name: 'bill_id', nullable: true }) billId: string;
  @ManyToOne(() => Bill, (b) => b.payments, { nullable: true }) @JoinColumn({ name: 'bill_id' }) bill: Bill;
  @Column({ name: 'order_id', nullable: true }) orderId: string;
  @Column({ name: 'shift_id', nullable: true }) shiftId: string;
  @Column({ type: 'enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;
  @Column({ name: 'reference_no', nullable: true }) referenceNo: string;
  @Column({ name: 'card_last4', nullable: true, length: 4 }) cardLast4: string;
  @Column({ name: 'upi_id', nullable: true }) upiId: string;
  @Column({ name: 'wallet_name', nullable: true }) walletName: string;
  @Column({ name: 'is_split', default: false }) isSplit: boolean;
  @Column({ default: 'success' }) status: string;
  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ name: 'processed_at', default: () => 'now()' }) processedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
