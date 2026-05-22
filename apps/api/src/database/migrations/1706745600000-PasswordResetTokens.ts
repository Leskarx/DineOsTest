import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetTokens1706745600000 implements MigrationInterface {
  name = 'PasswordResetTokens1706745600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        token_hash   VARCHAR(255) NOT NULL,
        expires_at   TIMESTAMPTZ NOT NULL,
        used_at      TIMESTAMPTZ,
        ip_address   VARCHAR(45),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_prt_user ON password_reset_tokens(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_prt_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens`);
  }
}
