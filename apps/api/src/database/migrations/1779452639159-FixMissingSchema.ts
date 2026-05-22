import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMissingSchema1779452639159 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add scheduled_at column to orders table
        await queryRunner.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ
        `);

        // Create menu_item_variations table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS menu_item_variations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(12,2) NOT NULL DEFAULT 0,
                cost_price NUMERIC(12,2) DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create indexes for menu_item_variations
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_menu_item_variations_menu 
            ON menu_item_variations(menu_item_id)
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_menu_item_variations_tenant 
            ON menu_item_variations(tenant_id)
        `);

        // Create trigger for menu_item_variations
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_menu_item_variations_updated_at 
            ON menu_item_variations
        `);
        
        await queryRunner.query(`
            CREATE TRIGGER update_menu_item_variations_updated_at 
                BEFORE UPDATE ON menu_item_variations 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop trigger
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS update_menu_item_variations_updated_at 
            ON menu_item_variations
        `);
        
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_menu_item_variations_menu`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_menu_item_variations_tenant`);
        
        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS menu_item_variations`);
        
        // Drop column
        await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS scheduled_at`);
    }
}