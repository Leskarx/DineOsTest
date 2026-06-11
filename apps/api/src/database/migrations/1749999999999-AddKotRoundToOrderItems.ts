import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKotRoundToOrderItems1749999999999 implements MigrationInterface {
  name = 'AddKotRoundToOrderItems1749999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add kot_round column (default 1 — existing items are all "round 1")
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "kot_round" smallint NOT NULL DEFAULT 1
    `);

    // Add kot_sent_at column
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "kot_sent_at" TIMESTAMP
    `);

    // Backfill kot_sent_at for existing items using created_at
    await queryRunner.query(`
      UPDATE "order_items"
      SET "kot_sent_at" = "created_at"
      WHERE "kot_sent_at" IS NULL
    `);

    // Add index for fast grouping by order + round on KDS
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_order_kot_round"
      ON "order_items" ("order_id", "kot_round")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_order_kot_round"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "kot_sent_at"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "kot_round"`);
  }
}