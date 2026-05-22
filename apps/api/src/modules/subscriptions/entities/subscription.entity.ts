import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active', TRIAL = 'trial', PAST_DUE = 'past_due', CANCELLED = 'cancelled', PAUSED = 'paused',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'plan_id', nullable: true }) planId: string | null;
  @ManyToOne(() => Plan, { nullable: true }) @JoinColumn({ name: 'plan_id' }) plan: Plan | null;
  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.TRIAL }) status: SubscriptionStatus;
  @Column({ name: 'trial_ends_at', nullable: true }) trialEndsAt: Date;
  @Column({ name: 'current_period_start', nullable: true }) currentPeriodStart: Date;
  @Column({ name: 'current_period_end', nullable: true }) currentPeriodEnd: Date;
  @Column({ name: 'razorpay_sub_id', nullable: true }) razorpaySubId: string;
  @Column({ name: 'cancelled_at', nullable: true }) cancelledAt: Date;
  @Column({ name: 'cancel_reason', nullable: true, type: 'text' }) cancelReason: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
