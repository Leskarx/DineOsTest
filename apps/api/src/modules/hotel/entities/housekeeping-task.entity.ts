import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum HkTaskType {
  CHECKOUT_CLEAN = 'checkout_clean',
  STAYOVER       = 'stayover',
  TURNDOWN       = 'turndown',
  INSPECTION     = 'inspection',
  MAINTENANCE    = 'maintenance',
}

export enum HkStatus {
  PENDING     = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE        = 'done',
  SKIPPED     = 'skipped',
}

export enum HkPriority { NORMAL = 'normal', HIGH = 'high', URGENT = 'urgent' }

@Entity('hotel_housekeeping_tasks')
@Index(['tenantId', 'branchId', 'scheduledFor'])
export class HousekeepingTask {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' })   @Index() tenantId: string;
  @Column({ name: 'branch_id' })            branchId: string;
  @Column({ name: 'room_id' })     @Index() roomId: string;

  @Column({ name: 'reservation_id', nullable: true }) reservationId: string;

  @Column({ name: 'task_type', type: 'enum', enum: HkTaskType })
  taskType: HkTaskType;

  @Column({ type: 'enum', enum: HkStatus, default: HkStatus.PENDING })
  status: HkStatus;

  @Column({ type: 'enum', enum: HkPriority, default: HkPriority.NORMAL })
  priority: HkPriority;

  @Column({ nullable: true, type: 'text' }) notes: string;

  @Column({ name: 'scheduled_for', type: 'date' })   scheduledFor: string;
  @Column({ name: 'assigned_to', nullable: true })   assignedTo: string;

  @Column({ name: 'started_at', nullable: true })    startedAt: Date;
  @Column({ name: 'completed_at', nullable: true })  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
