import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id' }) @Index() userId: string;
  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'token_hash' }) tokenHash: string;        // bcrypt hash of the raw token
  @Column({ name: 'expires_at' }) expiresAt: Date;
  @Column({ name: 'used_at', nullable: true }) usedAt: Date;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
