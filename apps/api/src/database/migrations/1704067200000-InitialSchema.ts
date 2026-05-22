import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration — creates all tables for Dine&Stay OS.
 * This mirrors init-db.sql and is the source of truth for version-controlled schema.
 */
export class InitialSchema1704067200000 implements MigrationInterface {
  name = 'InitialSchema1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Extensions ─────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE subscription_status AS ENUM ('trial','active','past_due','cancelled','paused');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('superadmin','owner','manager','cashier','waiter','kitchen','inventory');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('open','billed','cancelled','void');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE order_type AS ENUM ('dine_in','takeaway','delivery','room_service');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE kds_status AS ENUM ('pending','acknowledged','preparing','ready','served','recalled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_status AS ENUM ('draft','issued','paid','void','refunded');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gst_type AS ENUM ('cgst_sgst','igst','exempt');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('cash','card','upi','wallet','credit','complimentary','online');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE shift_status AS ENUM ('open','closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE inventory_txn_type AS ENUM ('purchase','sale','adjustment','wastage','transfer','opening');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE table_status AS ENUM ('available','occupied','reserved','cleaning');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ─── Plans ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code             VARCHAR(50) NOT NULL UNIQUE,
        name             VARCHAR(100) NOT NULL,
        description      TEXT,
        price_monthly    NUMERIC(10,2) NOT NULL DEFAULT 0,
        price_annual     NUMERIC(10,2) NOT NULL DEFAULT 0,
        price_yearly     NUMERIC(10,2) GENERATED ALWAYS AS (price_annual) STORED,
        max_branches     INT NOT NULL DEFAULT 1,
        max_users        INT NOT NULL DEFAULT 5,
        max_menu_items   INT NOT NULL DEFAULT 100,
        features         JSONB NOT NULL DEFAULT '[]',
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Tenants ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         VARCHAR(200) NOT NULL,
        slug         VARCHAR(100) NOT NULL UNIQUE,
        email        VARCHAR(200) NOT NULL UNIQUE,
        phone        VARCHAR(20),
        gstin        VARCHAR(15),
        address      TEXT,
        logo_url     TEXT,
        settings     JSONB NOT NULL DEFAULT '{}',
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Subscriptions ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id              UUID REFERENCES plans(id),
        status               subscription_status NOT NULL DEFAULT 'trial',
        trial_ends_at        TIMESTAMPTZ,
        current_period_start TIMESTAMPTZ,
        current_period_end   TIMESTAMPTZ,
        razorpay_sub_id      VARCHAR(100),
        cancelled_at         TIMESTAMPTZ,
        cancel_reason        TEXT,
        metadata             JSONB NOT NULL DEFAULT '{}',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id)`);

    // ─── Branches ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         VARCHAR(200) NOT NULL,
        code         VARCHAR(20) NOT NULL,
        address      TEXT,
        phone        VARCHAR(20),
        gstin        VARCHAR(15),
        is_hq        BOOLEAN NOT NULL DEFAULT FALSE,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        settings     JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, code)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id)`);

    // ─── Users ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id       UUID REFERENCES branches(id),
        email           VARCHAR(200),
        phone           VARCHAR(20),
        password_hash   VARCHAR(255) NOT NULL,
        first_name      VARCHAR(100) NOT NULL,
        last_name       VARCHAR(100),
        role            user_role NOT NULL DEFAULT 'cashier',
        pin             VARCHAR(6),
        employee_code   VARCHAR(20),
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at   TIMESTAMPTZ,
        refresh_token   TEXT,
        settings        JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE NULLS NOT DISTINCT (tenant_id, email),
        UNIQUE NULLS NOT DISTINCT (tenant_id, phone)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`);

    // ─── Categories ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id    UUID REFERENCES branches(id),
        name         VARCHAR(100) NOT NULL,
        description  TEXT,
        sort_order   INT NOT NULL DEFAULT 0,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        color        VARCHAR(20),
        icon         VARCHAR(100),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Menu Items ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id      UUID REFERENCES branches(id),
        category_id    UUID NOT NULL REFERENCES categories(id),
        name           VARCHAR(150) NOT NULL,
        description    TEXT,
        price          NUMERIC(10,2) NOT NULL DEFAULT 0,
        hsn_code       VARCHAR(20),
        gst_rate       NUMERIC(5,2) NOT NULL DEFAULT 5,
        is_veg         BOOLEAN NOT NULL DEFAULT TRUE,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order     INT NOT NULL DEFAULT 0,
        image_url      TEXT,
        tags           JSONB NOT NULL DEFAULT '[]',
        modifiers      JSONB NOT NULL DEFAULT '[]',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id)`);

    // ─── Table Sections ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS table_sections (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id    UUID NOT NULL REFERENCES branches(id),
        name         VARCHAR(100) NOT NULL,
        sort_order   INT NOT NULL DEFAULT 0,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Tables ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id     UUID NOT NULL REFERENCES branches(id),
        section_id    UUID REFERENCES table_sections(id),
        table_number  VARCHAR(20) NOT NULL,
        capacity      INT NOT NULL DEFAULT 4,
        status        table_status NOT NULL DEFAULT 'available',
        qr_code       TEXT,
        pos_x         INT,
        pos_y         INT,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_id, table_number)
      )
    `);

    // ─── Shifts ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id        UUID NOT NULL REFERENCES branches(id),
        shift_number     VARCHAR(20) NOT NULL,
        opened_by        UUID REFERENCES users(id),
        closed_by        UUID REFERENCES users(id),
        status           shift_status NOT NULL DEFAULT 'open',
        opening_cash     NUMERIC(12,2) NOT NULL DEFAULT 0,
        closing_cash     NUMERIC(12,2),
        expected_cash    NUMERIC(12,2),
        cash_difference  NUMERIC(12,2),
        total_sales      NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_orders     INT NOT NULL DEFAULT 0,
        total_refund     NUMERIC(12,2) NOT NULL DEFAULT 0,
        cash_sales       NUMERIC(12,2) NOT NULL DEFAULT 0,
        card_sales       NUMERIC(12,2) NOT NULL DEFAULT 0,
        upi_sales        NUMERIC(12,2) NOT NULL DEFAULT 0,
        wallet_sales     NUMERIC(12,2) NOT NULL DEFAULT 0,
        credit_sales     NUMERIC(12,2) NOT NULL DEFAULT 0,
        complimentary    NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_cgst       NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_sgst       NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_igst       NUMERIC(12,2) NOT NULL DEFAULT 0,
        notes            TEXT,
        closed_at        TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id, status)`);

    // ─── Shift Denominations ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shift_denominations (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        is_opening   BOOLEAN NOT NULL DEFAULT TRUE,
        note2000     INT NOT NULL DEFAULT 0,
        note500      INT NOT NULL DEFAULT 0,
        note200      INT NOT NULL DEFAULT 0,
        note100      INT NOT NULL DEFAULT 0,
        note50       INT NOT NULL DEFAULT 0,
        note20       INT NOT NULL DEFAULT 0,
        note10       INT NOT NULL DEFAULT 0,
        coin5        INT NOT NULL DEFAULT 0,
        coin2        INT NOT NULL DEFAULT 0,
        coin1        INT NOT NULL DEFAULT 0,
        total_amount NUMERIC(12,2) GENERATED ALWAYS AS (
          note2000*2000 + note500*500 + note200*200 + note100*100 +
          note50*50 + note20*20 + note10*10 + coin5*5 + coin2*2 + coin1*1
        ) STORED,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Orders ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id        UUID NOT NULL REFERENCES branches(id),
        shift_id         UUID REFERENCES shifts(id),
        table_id         UUID REFERENCES tables(id),
        order_number     VARCHAR(30) NOT NULL,
        order_type       order_type NOT NULL DEFAULT 'dine_in',
        status           order_status NOT NULL DEFAULT 'open',
        customer_name    VARCHAR(100),
        customer_phone   VARCHAR(20),
        customer_gstin   VARCHAR(15),
        cover_count      SMALLINT NOT NULL DEFAULT 1,
        subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_reason  TEXT,
        taxable_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
        cgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        sgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        igst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        cess_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_tax        NUMERIC(12,2) NOT NULL DEFAULT 0,
        round_off        NUMERIC(5,2) NOT NULL DEFAULT 0,
        grand_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
        notes            TEXT,
        billed_at        TIMESTAMPTZ,
        created_by       UUID REFERENCES users(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_id, order_number)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, created_at)`);

    // ─── Order Items ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id    UUID NOT NULL REFERENCES menu_items(id),
        tenant_id       UUID NOT NULL REFERENCES tenants(id),
        name            VARCHAR(150) NOT NULL,
        quantity        INT NOT NULL DEFAULT 1,
        unit_price      NUMERIC(10,2) NOT NULL,
        line_total      NUMERIC(12,2) NOT NULL,
        gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
        taxable_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
        cgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
        sgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
        igst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
        cess_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
        modifiers       JSONB NOT NULL DEFAULT '[]',
        notes           TEXT,
        kds_status      kds_status NOT NULL DEFAULT 'pending',
        kds_station     VARCHAR(50),
        is_voided       BOOLEAN NOT NULL DEFAULT FALSE,
        void_reason     TEXT,
        voided_by       UUID REFERENCES users(id),
        kot_number      VARCHAR(20),
        kot_printed_at  TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_order_items_kds ON order_items(tenant_id, kds_status) WHERE is_voided = FALSE`);

    // ─── Bills ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id        UUID NOT NULL REFERENCES branches(id),
        order_id         UUID NOT NULL REFERENCES orders(id),
        shift_id         UUID REFERENCES shifts(id),
        bill_number      VARCHAR(50) NOT NULL,
        invoice_number   VARCHAR(50),
        status           invoice_status NOT NULL DEFAULT 'issued',
        customer_name    VARCHAR(100),
        customer_phone   VARCHAR(20),
        customer_gstin   VARCHAR(15),
        customer_address TEXT,
        supply_type      gst_type NOT NULL DEFAULT 'cgst_sgst',
        subtotal         NUMERIC(12,2) NOT NULL,
        discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
        taxable_amount   NUMERIC(12,2) NOT NULL,
        cgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        sgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        igst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        cess_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_tax        NUMERIC(12,2) NOT NULL DEFAULT 0,
        round_off        NUMERIC(5,2) NOT NULL DEFAULT 0,
        grand_total      NUMERIC(12,2) NOT NULL,
        paid_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        change_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
        gst_summary      JSONB NOT NULL DEFAULT '[]',
        notes            TEXT,
        is_refunded      BOOLEAN NOT NULL DEFAULT FALSE,
        refund_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
        printed_count    SMALLINT NOT NULL DEFAULT 0,
        printed_at       TIMESTAMPTZ,
        issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(branch_id, bill_number)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bills_tenant ON bills(tenant_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bills_branch ON bills(branch_id, created_at)`);

    // ─── Payments ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id      UUID NOT NULL REFERENCES branches(id),
        bill_id        UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        order_id       UUID REFERENCES orders(id),
        shift_id       UUID REFERENCES shifts(id),
        method         payment_method NOT NULL,
        amount         NUMERIC(12,2) NOT NULL,
        reference_no   VARCHAR(100),
        card_last4     VARCHAR(4),
        upi_id         VARCHAR(50),
        wallet_name    VARCHAR(50),
        is_split       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift_id)`);

    // ─── Inventory Items ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id       UUID NOT NULL REFERENCES branches(id),
        name            VARCHAR(150) NOT NULL,
        sku             VARCHAR(50),
        unit            VARCHAR(20) NOT NULL DEFAULT 'piece',
        current_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
        reorder_level   NUMERIC(12,3) NOT NULL DEFAULT 0,
        cost_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
        avg_cost        NUMERIC(10,2) NOT NULL DEFAULT 0,
        category        VARCHAR(100),
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE NULLS NOT DISTINCT (branch_id, sku)
      )
    `);

    // ─── Inventory Transactions ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id           UUID NOT NULL REFERENCES branches(id),
        inventory_item_id   UUID NOT NULL REFERENCES inventory_items(id),
        type                inventory_txn_type NOT NULL,
        quantity            NUMERIC(12,3) NOT NULL,
        unit_cost           NUMERIC(10,2),
        total_cost          NUMERIC(12,2),
        balance_after       NUMERIC(12,3) NOT NULL,
        reference_id        UUID,
        reference_type      VARCHAR(50),
        notes               TEXT,
        created_by          UUID REFERENCES users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inv_txn_item ON inventory_transactions(inventory_item_id, created_at)`);

    // ─── GST Rates ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gst_rates (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         VARCHAR(100) NOT NULL,
        rate         NUMERIC(5,2) NOT NULL,
        hsn_code     VARCHAR(20),
        description  TEXT,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Audit Logs ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID,
        branch_id    UUID,
        user_id      UUID,
        action       VARCHAR(50) NOT NULL,
        entity       VARCHAR(100) NOT NULL,
        entity_id    VARCHAR(100),
        old_value    JSONB,
        new_value    JSONB,
        ip_address   VARCHAR(45),
        user_agent   TEXT,
        metadata     JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id)`);

    // ─── Updated_at triggers ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of ['plans', 'tenants', 'subscriptions', 'branches', 'users', 'categories',
      'menu_items', 'tables', 'table_sections', 'shifts', 'orders', 'order_items',
      'bills', 'inventory_items', 'gst_rates']) {
      await queryRunner.query(`
        DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
        CREATE TRIGGER trg_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    const tables = [
      'audit_logs', 'gst_rates', 'inventory_transactions', 'inventory_items',
      'payments', 'bills', 'order_items', 'orders', 'shift_denominations',
      'shifts', 'tables', 'table_sections', 'menu_items', 'categories',
      'users', 'branches', 'subscriptions', 'tenants', 'plans',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    for (const e of ['subscription_status','user_role','order_status','order_type','kds_status',
      'invoice_status','gst_type','payment_method','shift_status','inventory_txn_type','table_status']) {
      await queryRunner.query(`DROP TYPE IF EXISTS ${e}`);
    }
  }
}
