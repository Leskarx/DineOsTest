import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds remaining missing columns discovered during entity–DB sync.
 */
export class FixRemainingColumns1714521600000 implements MigrationInterface {
  name = 'FixRemainingColumns1714521600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── shifts — add opened_at (used by UI) ───────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);
    // Back-fill: use created_at for existing rows
    await queryRunner.query(`
      UPDATE shifts SET opened_at = created_at WHERE opened_at IS NULL;
    `);

    // ── inventory_items — add min_stock_level ─────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC(12,3) NOT NULL DEFAULT 0;
    `);

    // ── inventory_items — sync min_stock_level = reorder_level for existing rows ──
    await queryRunner.query(`
      UPDATE inventory_items SET min_stock_level = reorder_level WHERE min_stock_level = 0 AND reorder_level > 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE shifts DROP COLUMN IF EXISTS opened_at;`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP COLUMN IF EXISTS min_stock_level;`);
  }
}
