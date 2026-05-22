import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes orders and order_items to match entity definitions:
 * - Expands order_status enum with all workflow statuses
 * - Adds missing columns to orders table
 * - Adds missing columns to order_items table
 * - Converts order_items.quantity from INT to NUMERIC
 */
export class FixOrdersSchema1717200000000 implements MigrationInterface {
  name = 'FixOrdersSchema1717200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Expand order_status enum ─────────────────────────────────────────────
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'draft';`);
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'placed';`);
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';`);
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing';`);
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready';`);
    await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served';`);

    // ── orders — missing columns ─────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id);`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES users(id);`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS kot_printed BOOLEAN NOT NULL DEFAULT FALSE;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_printed BOOLEAN NOT NULL DEFAULT FALSE;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS synced BOOLEAN NOT NULL DEFAULT TRUE;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS offline_id VARCHAR(100);`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;`);
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;`);

    // ── order_items — convert quantity to NUMERIC for fractional support ─────
    await queryRunner.query(`
      ALTER TABLE order_items
        ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC(10,3);
    `);

    // ── order_items — make menu_item_id nullable (entity allows it) ──────────
    await queryRunner.query(`ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;`);

    // ── order_items — missing columns ────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku VARCHAR(50);`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_veg BOOLEAN NOT NULL DEFAULT TRUE;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_acknowledged_at TIMESTAMPTZ;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_ready_at TIMESTAMPTZ;`);
    await queryRunner.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 0;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values without recreating the type.
    // Only drop the columns we added.
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS sort_order;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS kds_ready_at;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS kds_acknowledged_at;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS is_veg;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS igst_rate;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS sgst_rate;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS cgst_rate;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS discount_amount;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS cost_price;`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS sku;`);
    await queryRunner.query(`ALTER TABLE order_items ALTER COLUMN quantity TYPE INT USING quantity::INT;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS served_at;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS placed_at;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS metadata;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS offline_id;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS synced;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS change_amount;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS paid_amount;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS bill_printed;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS kot_printed;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS cashier_id;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS waiter_id;`);
  }
}
