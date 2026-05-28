import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDashboardIndexes1779500000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bills_tenant_branch_created
      ON bills(tenant_id, branch_id, created_at);
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_tenant_branch_status
      ON orders(tenant_id, branch_id, status);
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_tenant_branch_created
      ON payments(tenant_id, branch_id, created_at);
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_tenant_branch_dates
      ON hotel_reservations(tenant_id, branch_id, check_in_date, check_out_date);
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_tenant_branch_stock
      ON inventory_items(tenant_id, branch_id, current_stock);
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_bills_tenant_branch_created;
    `);

        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_orders_tenant_branch_status;
    `);

        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_payments_tenant_branch_created;
    `);

        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_reservations_tenant_branch_dates;
    `);

        await queryRunner.query(`
      DROP INDEX IF EXISTS idx_inventory_tenant_branch_stock;
    `);
    }
}