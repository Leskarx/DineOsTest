import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance indexes identified during audit (2026-05-27).
 *
 * These cover the five hottest query patterns in the application:
 *
 *   1. POS open-orders poll: WHERE branch_id = $1 AND status NOT IN ('billed','cancelled')
 *   2. Reports daily-sales / GST: WHERE branch_id = $1 AND created_at BETWEEN $2 AND $3
 *   3. KDS / addItems join:       WHERE order_id = $1 (order_items)
 *   4. Billing reports:           WHERE branch_id = $1 AND tenant_id = $2 AND created_at ...
 *   5. Inventory low-stock alert: WHERE branch_id = $1 AND current_stock <= min_stock_level
 *
 * All created with IF NOT EXISTS so re-running is safe.
 */
export class AddPerformanceIndexes1779900000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── orders ───────────────────────────────────────────────────────────────

    // Speeds up the POS open-orders poll (status filter + branch scope).
    // Partial index only covers non-terminal rows so it stays small as data grows.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_branch_active_status
      ON orders (branch_id, status)
      WHERE status NOT IN ('billed', 'cancelled', 'void')
    `);

    // Speeds up all date-range report queries on the orders table.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_branch_created_at
      ON orders (branch_id, tenant_id, created_at DESC)
    `);

    // ── order_items ──────────────────────────────────────────────────────────

    // Speeds up the order_items JOIN in reports (item-sales, category reports)
    // and the KDS aggregate query in handleKdsItemStatus.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items (order_id)
      WHERE is_voided = false
    `);

    // ── bills ────────────────────────────────────────────────────────────────

    // Speeds up daily-sales, GST, and payment-method reports that all filter
    // on branch_id + tenant_id + created_at / issued_at date ranges.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bills_branch_tenant_created
      ON bills (branch_id, tenant_id, created_at DESC)
    `);

    // ── inventory_items ──────────────────────────────────────────────────────

    // Speeds up the low-stock alert count in getDashboardSummary.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
      ON inventory_items (branch_id, tenant_id, current_stock, min_stock_level)
      WHERE is_active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_branch_active_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_branch_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_items_order_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bills_branch_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_low_stock`);
  }
}
