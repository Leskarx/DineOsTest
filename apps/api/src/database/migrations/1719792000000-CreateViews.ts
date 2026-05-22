import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates database views used by service layer:
 * - v_stock_summary: aggregated stock status per inventory item
 */
export class CreateViews1719792000000 implements MigrationInterface {
  name = 'CreateViews1719792000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_stock_summary AS
      SELECT
        ii.id,
        ii.tenant_id,
        ii.branch_id,
        ii.name,
        ii.sku,
        ii.unit,
        ii.current_stock,
        ii.min_stock_level,
        ii.reorder_level,
        ii.cost_price,
        ii.avg_cost,
        CASE
          WHEN ii.current_stock <= 0 THEN 'out_of_stock'
          WHEN ii.current_stock <= ii.min_stock_level THEN 'low_stock'
          WHEN ii.current_stock <= ii.reorder_level THEN 'reorder'
          ELSE 'adequate'
        END AS stock_status
      FROM inventory_items ii
      WHERE ii.is_active = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS v_stock_summary;`);
  }
}
