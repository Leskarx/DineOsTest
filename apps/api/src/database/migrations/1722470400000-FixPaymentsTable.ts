import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes payments table to match the Payment entity:
 * - Adds `status`, `notes`, `processed_at` columns
 * - Makes `bill_id` nullable (entity allows payment without a bill e.g. advance)
 */
export class FixPaymentsTable1722470400000 implements MigrationInterface {
  name = 'FixPaymentsTable1722470400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success';`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    // Make bill_id nullable for advance payments / pre-bill flow
    await queryRunner.query(`ALTER TABLE payments ALTER COLUMN bill_id DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS processed_at;`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS notes;`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS status;`);
    await queryRunner.query(`ALTER TABLE payments ALTER COLUMN bill_id SET NOT NULL;`);
  }
}
