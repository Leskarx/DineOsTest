import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', nullable: true }) @Index() tenantId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'user_id', nullable: true }) userId: string;
  @Column({ length: 50 }) action: string;        // CREATE | UPDATE | DELETE | LOGIN | VOID
  @Column({ length: 100 }) entity: string;        // orders | bills | users | shifts
  @Column({ name: 'entity_id', nullable: true, length: 100 }) entityId: string;
  @Column({ name: 'old_value', type: 'jsonb', nullable: true }) oldValue: any;
  @Column({ name: 'new_value', type: 'jsonb', nullable: true }) newValue: any;
  @Column({ name: 'ip_address', nullable: true, length: 45 }) ipAddress: string;
  @Column({ name: 'user_agent', nullable: true, type: 'text' }) userAgent: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
