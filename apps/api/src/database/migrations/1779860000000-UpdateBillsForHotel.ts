import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateBillsForHotel1779860000000 implements MigrationInterface {
  name = 'UpdateBillsForHotel1779860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Make order_id nullable
    await queryRunner.query(`ALTER TABLE "bills" ALTER COLUMN "order_id" DROP NOT NULL`);
    
    // 2. Add reservation_id and source columns
    await queryRunner.query(`ALTER TABLE "bills" ADD "reservation_id" uuid`);
    await queryRunner.query(`ALTER TABLE "bills" ADD "source" character varying NOT NULL DEFAULT 'pos'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN "reservation_id"`);
    await queryRunner.query(`ALTER TABLE "bills" ALTER COLUMN "order_id" SET NOT NULL`);
  }
}
