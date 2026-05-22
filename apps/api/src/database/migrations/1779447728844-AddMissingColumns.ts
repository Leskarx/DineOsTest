import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumns1779447728844 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add missing columns to orders table
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='orders' AND column_name='is_complimentary') THEN
                    ALTER TABLE "orders" ADD "is_complimentary" boolean DEFAULT false;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='orders' AND column_name='is_sales_return') THEN
                    ALTER TABLE "orders" ADD "is_sales_return" boolean DEFAULT false;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='orders' AND column_name='type') THEN
                    ALTER TABLE "orders" ADD "type" character varying(50) DEFAULT 'dine_in';
                END IF;
            END $$;
        `);

        // Add missing column to table_sections
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='table_sections' AND column_name='description') THEN
                    ALTER TABLE "table_sections" ADD "description" text;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the columns if needed (rollback)
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "is_complimentary"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "is_sales_return"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "type"`);
        await queryRunner.query(`ALTER TABLE "table_sections" DROP COLUMN IF EXISTS "description"`);
    }
}