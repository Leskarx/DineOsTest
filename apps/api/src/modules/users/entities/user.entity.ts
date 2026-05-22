import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';

export enum UserRole {
  SUPERADMIN = 'superadmin',
  OWNER = 'owner',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  KITCHEN = 'kitchen',
  INVENTORY = 'inventory',
}

@Entity('users')
@Index(['tenantId', 'email'], { unique: true, where: '"email" IS NOT NULL' })
@Index(['tenantId', 'phone'], { unique: true, where: '"phone" IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ name: 'first_name' }) firstName: string;
  @Column({ name: 'last_name', nullable: true }) lastName: string;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.CASHIER }) role: UserRole;
  @Column({ nullable: true, length: 6 }) pin: string;
  @Column({ name: 'employee_code', nullable: true }) employeeCode: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'last_login_at', nullable: true }) lastLoginAt: Date;
  @Column({ name: 'refresh_token', nullable: true, type: 'text' }) refreshToken: string;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  get fullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }
}
