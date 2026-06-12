import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryFieldsToBills1749999999999 implements MigrationInterface {
  name = 'AddDeliveryFieldsToBills1749999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the order_type enum if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."bills_order_type_enum" AS ENUM (
          'dine_in', 'takeaway', 'delivery', 'room_service'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create the delivery_payment_type enum if it doesn't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."bills_delivery_payment_type_enum" AS ENUM (
          'cod', 'prepaid'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 3. Add order_type column
    await queryRunner.query(`
      ALTER TABLE "bills"
      ADD COLUMN IF NOT EXISTS "order_type"
        "public"."bills_order_type_enum"
        DEFAULT 'dine_in'
    `);

    // 4. Add delivery_address column
    await queryRunner.query(`
      ALTER TABLE "bills"
      ADD COLUMN IF NOT EXISTS "delivery_address"
        TEXT
        DEFAULT NULL
    `);

    // 5. Add delivery_payment_type column
    await queryRunner.query(`
      ALTER TABLE "bills"
      ADD COLUMN IF NOT EXISTS "delivery_payment_type"
        "public"."bills_delivery_payment_type_enum"
        DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN IF EXISTS "delivery_payment_type"`);
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN IF EXISTS "delivery_address"`);
    await queryRunner.query(`ALTER TABLE "bills" DROP COLUMN IF EXISTS "order_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."bills_delivery_payment_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."bills_order_type_enum"`);
  }
}