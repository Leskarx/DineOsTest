import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds missing columns so TypeORM entities match the actual DB schema.
 * All statements use IF NOT EXISTS / DO NOTHING so re-running is safe.
 */
export class SyncMissingColumns1711929600000 implements MigrationInterface {
  name = 'SyncMissingColumns1711929600000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── 1. branch_type enum + branches columns ────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE branch_type AS ENUM ('restaurant','hotel','cafe','bakery','cloud_kitchen');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    const branchCols: [string, string][] = [
      ['type',        `branch_type NOT NULL DEFAULT 'restaurant'`],
      ['fssai_no',    `VARCHAR(30)`],
      ['address_line1','TEXT'],
      ['city',        `VARCHAR(100)`],
      ['state',       `VARCHAR(100)`],
      ['state_code',  `VARCHAR(2)`],
      ['pincode',     `VARCHAR(10)`],
      ['email',       `VARCHAR(200)`],
      ['timezone',    `VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata'`],
      ['currency',    `VARCHAR(5)  NOT NULL DEFAULT 'INR'`],
    ];

    for (const [col, def] of branchCols) {
      await queryRunner.query(`
        ALTER TABLE branches ADD COLUMN IF NOT EXISTS ${col} ${def};
      `);
    }

    // ── 2. categories — parent_id, image_url ──────────────────────────────────
    await queryRunner.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID;`);
    await queryRunner.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;`);

    // ── 3. gst_rates — cgst, sgst, igst, cess, hsn_sac_code ─────────────────
    const gstCols: [string, string][] = [
      ['cgst_rate',   `NUMERIC(5,2)`],
      ['sgst_rate',   `NUMERIC(5,2)`],
      ['igst_rate',   `NUMERIC(5,2)`],
      ['cess_rate',   `NUMERIC(5,2) NOT NULL DEFAULT 0`],
      ['hsn_sac_code','VARCHAR(20)'],
    ];

    for (const [col, def] of gstCols) {
      await queryRunner.query(`ALTER TABLE gst_rates ADD COLUMN IF NOT EXISTS ${col} ${def};`);
    }

    // ── 4. item_type enum + menu_items columns ────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE item_type AS ENUM ('food','beverage','alcohol','tobacco','accommodation');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    const menuCols: [string, string][] = [
      ['gst_rate_id',       `UUID`],
      ['short_code',        `VARCHAR(20)`],
      ['sku',               `VARCHAR(50)`],
      ['barcode',           `VARCHAR(50)`],
      ['type',              `item_type NOT NULL DEFAULT 'food'`],
      ['cost_price',        `NUMERIC(10,2)`],
      ['is_available',      `BOOLEAN NOT NULL DEFAULT true`],
      ['is_addon',          `BOOLEAN NOT NULL DEFAULT false`],
      ['track_inventory',   `BOOLEAN NOT NULL DEFAULT false`],
      ['inventory_item_id', `UUID`],
    ];

    for (const [col, def] of menuCols) {
      await queryRunner.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS ${col} ${def};`);
    }

    // Add FK for gst_rate_id (safe — only runs if column was just created)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE menu_items
          ADD CONSTRAINT menu_items_gst_rate_id_fkey
          FOREIGN KEY (gst_rate_id) REFERENCES gst_rates(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── 5. Populate is_available from is_active where it's still the default ──
    await queryRunner.query(`
      UPDATE menu_items SET is_available = is_active WHERE is_available = true;
    `);

    // ── 6. users — add pin column if missing ─────────────────────────────────
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin VARCHAR(6);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse — drop all added columns
    const dropMenuCols = ['gst_rate_id','short_code','sku','barcode','type','cost_price','is_available','is_addon','track_inventory','inventory_item_id'];
    for (const col of dropMenuCols) {
      await queryRunner.query(`ALTER TABLE menu_items DROP COLUMN IF EXISTS ${col};`);
    }

    const dropGstCols = ['cgst_rate','sgst_rate','igst_rate','cess_rate','hsn_sac_code'];
    for (const col of dropGstCols) {
      await queryRunner.query(`ALTER TABLE gst_rates DROP COLUMN IF EXISTS ${col};`);
    }

    await queryRunner.query(`ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;`);
    await queryRunner.query(`ALTER TABLE categories DROP COLUMN IF EXISTS image_url;`);

    const dropBranchCols = ['type','fssai_no','address_line1','city','state','state_code','pincode','email','timezone','currency'];
    for (const col of dropBranchCols) {
      await queryRunner.query(`ALTER TABLE branches DROP COLUMN IF EXISTS ${col};`);
    }

    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS pin;`);
    await queryRunner.query(`DROP TYPE IF EXISTS item_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS branch_type;`);
  }
}
