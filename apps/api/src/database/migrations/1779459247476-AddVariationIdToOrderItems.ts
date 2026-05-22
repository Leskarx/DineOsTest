import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVariationIdToOrderItems1779459247476 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add variation_id column to order_items table
        await queryRunner.query(`
            ALTER TABLE order_items 
            ADD COLUMN IF NOT EXISTS variation_id UUID
        `);

        // Add variation_name column to order_items table
        await queryRunner.query(`
            ALTER TABLE order_items 
            ADD COLUMN IF NOT EXISTS variation_name VARCHAR(100)
        `);

        // Create index for variation_id
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_order_items_variation_id 
            ON order_items(variation_id)
        `);

        // Add foreign key constraint
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_order_items_variation_id'
                    AND table_name = 'order_items'
                ) THEN
                    ALTER TABLE order_items 
                    ADD CONSTRAINT fk_order_items_variation_id 
                    FOREIGN KEY (variation_id) 
                    REFERENCES menu_item_variations(id) 
                    ON DELETE SET NULL;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraint
        await queryRunner.query(`
            ALTER TABLE order_items 
            DROP CONSTRAINT IF EXISTS fk_order_items_variation_id
        `);
        
        // Drop index
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_order_items_variation_id
        `);
        
        // Drop columns
        await queryRunner.query(`
            ALTER TABLE order_items 
            DROP COLUMN IF EXISTS variation_id,
            DROP COLUMN IF EXISTS variation_name
        `);
    }
}