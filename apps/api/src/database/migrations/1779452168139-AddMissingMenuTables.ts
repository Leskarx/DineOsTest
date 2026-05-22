import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingMenuTables1779452168139 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create modifier_groups table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS modifier_groups (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                min_select INTEGER DEFAULT 0,
                max_select INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create modifiers table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS modifiers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(12,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create menu_item_modifiers table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS menu_item_modifiers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create addon_groups table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS addon_groups (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                min_select INTEGER DEFAULT 0,
                max_select INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create addons table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS addons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                addon_group_id UUID REFERENCES addon_groups(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(12,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create menu_item_addons table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS menu_item_addons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                addon_group_id UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_modifier_groups_tenant ON modifier_groups(tenant_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_modifier_groups_branch ON modifier_groups(branch_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(modifier_group_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_menu ON menu_item_modifiers(menu_item_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_group ON menu_item_modifiers(modifier_group_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_addon_groups_tenant ON addon_groups(tenant_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_addon_groups_branch ON addon_groups(branch_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_addons_group ON addons(addon_group_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_item_addons_menu ON menu_item_addons(menu_item_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_item_addons_group ON menu_item_addons(addon_group_id)`);

        // Create updated_at trigger function if not exists
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);

        // Add triggers
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_modifier_groups_updated_at ON modifier_groups`);
        await queryRunner.query(`CREATE TRIGGER update_modifier_groups_updated_at BEFORE UPDATE ON modifier_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
        
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_modifiers_updated_at ON modifiers`);
        await queryRunner.query(`CREATE TRIGGER update_modifiers_updated_at BEFORE UPDATE ON modifiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
        
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_menu_item_modifiers_updated_at ON menu_item_modifiers`);
        await queryRunner.query(`CREATE TRIGGER update_menu_item_modifiers_updated_at BEFORE UPDATE ON menu_item_modifiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
        
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_addon_groups_updated_at ON addon_groups`);
        await queryRunner.query(`CREATE TRIGGER update_addon_groups_updated_at BEFORE UPDATE ON addon_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
        
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_addons_updated_at ON addons`);
        await queryRunner.query(`CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
        
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_menu_item_addons_updated_at ON menu_item_addons`);
        await queryRunner.query(`CREATE TRIGGER update_menu_item_addons_updated_at BEFORE UPDATE ON menu_item_addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_modifier_groups_updated_at ON modifier_groups`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_modifiers_updated_at ON modifiers`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_menu_item_modifiers_updated_at ON menu_item_modifiers`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_addon_groups_updated_at ON addon_groups`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_addons_updated_at ON addons`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_menu_item_addons_updated_at ON menu_item_addons`);

        // Drop tables in reverse order
        await queryRunner.query(`DROP TABLE IF EXISTS menu_item_addons`);
        await queryRunner.query(`DROP TABLE IF EXISTS addons`);
        await queryRunner.query(`DROP TABLE IF EXISTS addon_groups`);
        await queryRunner.query(`DROP TABLE IF EXISTS menu_item_modifiers`);
        await queryRunner.query(`DROP TABLE IF EXISTS modifiers`);
        await queryRunner.query(`DROP TABLE IF EXISTS modifier_groups`);
    }
}