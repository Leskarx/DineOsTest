import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes two schema mismatches discovered during runtime:
 *
 * 1. tenants table — missing columns that the Tenant entity declares:
 *      pan, fssai_no, address_line1, address_line2, state, state_code,
 *      pincode, tax_regime enum
 *    (The InitialSchema only created: id, name, slug, email, phone, gstin,
 *     address, logo_url, settings, is_active, created_at, updated_at)
 *
 * 2. users.pin — was created as VARCHAR(6) in SyncMissingColumns migration
 *    but the service hashes PINs with bcrypt (60-char output), so it must
 *    be VARCHAR(72).
 *
 * All statements are idempotent — safe to re-run.
 */
export class FixTenantAndPinSchema1779480000000 implements MigrationInterface {
  name = 'FixTenantAndPinSchema1779480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── 1. tax_regime enum ─────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE tax_regime AS ENUM ('composition', 'regular');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── 2. tenants — add all missing columns ──────────────────────────────────
    // Each uses IF NOT EXISTS so re-running is safe.

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pan VARCHAR(10);
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fssai_no VARCHAR(20);
    `);

    // The original InitialSchema used a single "address TEXT" column.
    // The entity now splits it into address_line1 / address_line2.
    // We keep the old address column untouched (don't drop it — other
    // code may still reference it) and simply add the new ones.
    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_line1 TEXT;
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_line2 TEXT;
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(100);
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country VARCHAR(60) NOT NULL DEFAULT 'India';
    `);

    await queryRunner.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_regime tax_regime NOT NULL DEFAULT 'regular';
    `);

    // ── 3. users.pin — widen from VARCHAR(6) to VARCHAR(72) ───────────────────
    // bcrypt output is always 60 chars; 72 is the safe conventional column size.
    // ALTER COLUMN TYPE is safe here — existing hashed values already fit.
    await queryRunner.query(`
      ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(72);
    `);

    // ── 4. Back-fill address_line1 from the old address column ────────────────
    // Only touch rows where address_line1 is still NULL but address has data.
    await queryRunner.query(`
      UPDATE tenants
         SET address_line1 = address
       WHERE address_line1 IS NULL
         AND address IS NOT NULL
         AND address <> '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert pin width (will fail if any stored value exceeds 6 chars — expected)
    await queryRunner.query(`
      ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(6);
    `);

    // Drop tenant columns in reverse order
    const tenantCols = [
      'tax_regime',
      'country',
      'pincode',
      'state_code',
      'state',
      'city',
      'address_line2',
      'address_line1',
      'fssai_no',
      'pan',
    ];

    for (const col of tenantCols) {
      await queryRunner.query(`
        ALTER TABLE tenants DROP COLUMN IF EXISTS ${col};
      `);
    }

    await queryRunner.query(`DROP TYPE IF EXISTS tax_regime;`);
  }
}