-- ============================================================
--  Dine&Stay OS  –  Baseline PostgreSQL Schema
--  Multi-tenant, India GST-compliant restaurant POS + hotel
--
--  PURPOSE: Bootstrap a brand-new empty database only.
--  PostgreSQL runs this file ONCE via docker-entrypoint-initdb.d
--  on the very first container start (when the data volume is empty).
--
--  SOURCE OF TRUTH: TypeORM migrations in apps/api/src/database/migrations/
--  All schema changes after initial setup MUST be done via migrations,
--  not by editing this file. Migrations run automatically on every deploy.
--
--  If this script conflicts with migrations on a fresh install, the
--  migrations take precedence — they use CREATE TABLE IF NOT EXISTS
--  and ALTER TABLE ... ADD COLUMN IF NOT EXISTS patterns.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE plan_code         AS ENUM ('starter', 'growth', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'past_due', 'cancelled', 'paused');
CREATE TYPE branch_type       AS ENUM ('restaurant', 'hotel', 'cafe', 'bakery', 'cloud_kitchen');
CREATE TYPE user_role         AS ENUM ('superadmin', 'owner', 'manager', 'cashier', 'waiter', 'kitchen', 'inventory');
CREATE TYPE table_status      AS ENUM ('available', 'occupied', 'reserved', 'cleaning');
CREATE TYPE order_type        AS ENUM ('dine_in', 'takeaway', 'delivery', 'room_service');
CREATE TYPE order_status      AS ENUM ('draft', 'placed', 'confirmed', 'preparing', 'ready', 'served', 'billed', 'cancelled');
CREATE TYPE payment_method    AS ENUM ('cash', 'card', 'upi', 'wallet', 'credit', 'complimentary');
CREATE TYPE gst_type          AS ENUM ('cgst_sgst', 'igst', 'exempt');
CREATE TYPE item_type         AS ENUM ('food', 'beverage', 'alcohol', 'tobacco', 'accommodation');
CREATE TYPE transaction_type  AS ENUM ('purchase', 'sale', 'waste', 'adjustment', 'opening', 'transfer');
CREATE TYPE shift_status      AS ENUM ('open', 'closed');
CREATE TYPE kds_status        AS ENUM ('pending', 'acknowledged', 'preparing', 'ready', 'recalled');
CREATE TYPE invoice_status    AS ENUM ('draft', 'issued', 'paid', 'void', 'refunded');
CREATE TYPE tax_regime        AS ENUM ('composition', 'regular');

-- ─── TENANTS (multi-tenant root) ─────────────────────────────────────────────

CREATE TABLE tenants (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              varchar(200) NOT NULL,
  slug              varchar(100) NOT NULL UNIQUE,
  gstin             varchar(15),
  pan               varchar(10),
  fssai_no          varchar(20),
  address_line1     text,
  address_line2     text,
  city              varchar(100),
  state             varchar(100),
  state_code        varchar(2),
  pincode           varchar(10),
  country           varchar(50) DEFAULT 'India',
  email             varchar(150) NOT NULL,
  phone             varchar(15),
  logo_url          text,
  tax_regime        tax_regime DEFAULT 'regular',
  is_active         boolean DEFAULT true,
  settings          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─── SUBSCRIPTION PLANS ───────────────────────────────────────────────────────

CREATE TABLE plans (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              plan_code NOT NULL UNIQUE,
  name              varchar(100) NOT NULL,
  description       text,
  price_monthly     numeric(10,2) NOT NULL,
  price_annual      numeric(10,2),
  max_branches      smallint DEFAULT 1,
  max_users         smallint DEFAULT 5,
  max_menu_items    int DEFAULT 100,
  features          jsonb DEFAULT '[]',
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

INSERT INTO plans (code, name, description, price_monthly, price_annual, max_branches, max_users, max_menu_items, features) VALUES
('starter',    'Starter',    'Perfect for single outlet restaurants',             2999,  29990,  1,   10,  200,  '["pos","billing","gst","kds","inventory","shifts","reports_basic","thermal_print","offline_sync"]'),
('growth',     'Growth',     'Multi-branch with advanced analytics',              7999,  79990,  5,   50,  1000, '["pos","billing","gst","kds","inventory","shifts","reports_advanced","thermal_print","offline_sync","multi_branch","hq_dashboard","inventory_advanced","employee_mgmt"]'),
('enterprise', 'Enterprise', 'Unlimited scale with white-labelling & API access', 0,     0,      -1, -1, -1,   '["all"]');

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES plans(id),
  status            subscription_status DEFAULT 'trial',
  trial_ends_at     timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  razorpay_sub_id   varchar(100),
  razorpay_plan_id  varchar(100),
  cancelled_at      timestamptz,
  cancel_reason     text,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE feature_flags (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key       varchar(100) NOT NULL,
  is_enabled        boolean DEFAULT false,
  config            jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

-- ─── BRANCHES ─────────────────────────────────────────────────────────────────

CREATE TABLE branches (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(200) NOT NULL,
  code              varchar(20) NOT NULL,
  type              branch_type DEFAULT 'restaurant',
  gstin             varchar(15),
  fssai_no          varchar(20),
  address_line1     text,
  address_line2     text,
  city              varchar(100),
  state             varchar(100),
  state_code        varchar(2),
  pincode           varchar(10),
  phone             varchar(15),
  email             varchar(150),
  timezone          varchar(50) DEFAULT 'Asia/Kolkata',
  currency          varchar(5) DEFAULT 'INR',
  is_hq             boolean DEFAULT false,
  is_active         boolean DEFAULT true,
  settings          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ─── USERS & ROLES ────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES branches(id),
  email             varchar(150),
  phone             varchar(15),
  password_hash     text NOT NULL,
  first_name        varchar(100) NOT NULL,
  last_name         varchar(100),
  role              user_role DEFAULT 'cashier',
  pin               varchar(6),
  employee_code     varchar(20),
  is_active         boolean DEFAULT true,
  last_login_at     timestamptz,
  refresh_token     text,
  settings          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, phone)
);

CREATE TABLE user_branches (
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, branch_id)
);

-- ─── TABLE SECTIONS & TABLES ──────────────────────────────────────────────────

CREATE TABLE table_sections (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(100) NOT NULL,
  description       text,
  color             varchar(7) DEFAULT '#6366f1',
  sort_order        smallint DEFAULT 0,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE tables (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_id        uuid REFERENCES table_sections(id),
  name              varchar(50) NOT NULL,
  capacity          smallint DEFAULT 4,
  status            table_status DEFAULT 'available',
  qr_code           text,
  position_x        int DEFAULT 0,
  position_y        int DEFAULT 0,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─── MENU CATEGORIES & ITEMS ──────────────────────────────────────────────────

CREATE TABLE categories (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES branches(id),
  parent_id         uuid REFERENCES categories(id),
  name              varchar(100) NOT NULL,
  description       text,
  image_url         text,
  color             varchar(7),
  sort_order        smallint DEFAULT 0,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE gst_rates (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(50) NOT NULL,
  rate              numeric(5,2) NOT NULL,
  cgst_rate         numeric(5,2),
  sgst_rate         numeric(5,2),
  igst_rate         numeric(5,2),
  cess_rate         numeric(5,2) DEFAULT 0,
  hsn_sac_code      varchar(20),
  applicable_on     item_type[] DEFAULT '{"food"}',
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- Standard GST rates (seeded via tenant setup)

CREATE TABLE menu_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES branches(id),
  category_id       uuid REFERENCES categories(id),
  gst_rate_id       uuid REFERENCES gst_rates(id),
  name              varchar(200) NOT NULL,
  description       text,
  short_code        varchar(20),
  sku               varchar(50),
  barcode           varchar(50),
  image_url         text,
  type              item_type DEFAULT 'food',
  price             numeric(10,2) NOT NULL,
  cost_price        numeric(10,2),
  is_veg            boolean DEFAULT true,
  is_available      boolean DEFAULT true,
  is_addon          boolean DEFAULT false,
  track_inventory   boolean DEFAULT false,
  inventory_item_id uuid,
  tags              text[] DEFAULT '{}',
  sort_order        smallint DEFAULT 0,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE modifier_groups (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(100) NOT NULL,
  min_selections    smallint DEFAULT 0,
  max_selections    smallint DEFAULT 1,
  is_required       boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE modifiers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id          uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(100) NOT NULL,
  price             numeric(10,2) DEFAULT 0,
  is_active         boolean DEFAULT true,
  sort_order        smallint DEFAULT 0
);

CREATE TABLE menu_item_modifier_groups (
  menu_item_id      uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY(menu_item_id, modifier_group_id)
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  table_id          uuid REFERENCES tables(id),
  shift_id          uuid,
  order_number      varchar(30) NOT NULL,
  type              order_type DEFAULT 'dine_in',
  status            order_status DEFAULT 'draft',
  customer_name     varchar(200),
  customer_phone    varchar(15),
  customer_gstin    varchar(15),
  waiter_id         uuid REFERENCES users(id),
  cashier_id        uuid REFERENCES users(id),
  covers            smallint DEFAULT 1,
  notes             text,
  kot_printed       boolean DEFAULT false,
  bill_printed      boolean DEFAULT false,
  subtotal          numeric(12,2) DEFAULT 0,
  discount_amount   numeric(12,2) DEFAULT 0,
  discount_percent  numeric(5,2) DEFAULT 0,
  taxable_amount    numeric(12,2) DEFAULT 0,
  cgst_amount       numeric(12,2) DEFAULT 0,
  sgst_amount       numeric(12,2) DEFAULT 0,
  igst_amount       numeric(12,2) DEFAULT 0,
  cess_amount       numeric(12,2) DEFAULT 0,
  total_tax         numeric(12,2) DEFAULT 0,
  round_off         numeric(5,2) DEFAULT 0,
  grand_total       numeric(12,2) DEFAULT 0,
  paid_amount       numeric(12,2) DEFAULT 0,
  change_amount     numeric(12,2) DEFAULT 0,
  synced            boolean DEFAULT true,
  offline_id        varchar(50),
  metadata          jsonb DEFAULT '{}',
  placed_at         timestamptz,
  served_at         timestamptz,
  billed_at         timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(branch_id, order_number)
);

CREATE TABLE order_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id      uuid REFERENCES menu_items(id),
  name              varchar(200) NOT NULL,
  sku               varchar(50),
  quantity          numeric(10,3) NOT NULL,
  unit_price        numeric(10,2) NOT NULL,
  cost_price        numeric(10,2),
  discount_amount   numeric(10,2) DEFAULT 0,
  taxable_amount    numeric(10,2) DEFAULT 0,
  gst_rate          numeric(5,2) DEFAULT 0,
  cgst_rate         numeric(5,2) DEFAULT 0,
  sgst_rate         numeric(5,2) DEFAULT 0,
  igst_rate         numeric(5,2) DEFAULT 0,
  cgst_amount       numeric(10,2) DEFAULT 0,
  sgst_amount       numeric(10,2) DEFAULT 0,
  igst_amount       numeric(10,2) DEFAULT 0,
  cess_amount       numeric(10,2) DEFAULT 0,
  line_total        numeric(10,2) NOT NULL,
  is_veg            boolean DEFAULT true,
  notes             text,
  kds_status        kds_status DEFAULT 'pending',
  kds_acknowledged_at timestamptz,
  kds_ready_at      timestamptz,
  is_voided         boolean DEFAULT false,
  void_reason       text,
  sort_order        smallint DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE order_item_modifiers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id     uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id       uuid REFERENCES modifiers(id),
  modifier_group_id uuid REFERENCES modifier_groups(id),
  name              varchar(100) NOT NULL,
  price             numeric(10,2) DEFAULT 0
);

-- ─── BILLS & PAYMENTS ─────────────────────────────────────────────────────────

CREATE TABLE bills (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  order_id          uuid NOT NULL REFERENCES orders(id),
  shift_id          uuid,
  bill_number       varchar(30) NOT NULL,
  invoice_number    varchar(50),
  status            invoice_status DEFAULT 'issued',
  customer_name     varchar(200),
  customer_phone    varchar(15),
  customer_gstin    varchar(15),
  customer_address  text,
  supply_type       gst_type DEFAULT 'cgst_sgst',
  subtotal          numeric(12,2) NOT NULL,
  discount_amount   numeric(12,2) DEFAULT 0,
  taxable_amount    numeric(12,2) NOT NULL,
  cgst_amount       numeric(12,2) DEFAULT 0,
  sgst_amount       numeric(12,2) DEFAULT 0,
  igst_amount       numeric(12,2) DEFAULT 0,
  cess_amount       numeric(12,2) DEFAULT 0,
  total_tax         numeric(12,2) DEFAULT 0,
  round_off         numeric(5,2) DEFAULT 0,
  grand_total       numeric(12,2) NOT NULL,
  paid_amount       numeric(12,2) DEFAULT 0,
  change_amount     numeric(12,2) DEFAULT 0,
  gst_summary       jsonb DEFAULT '[]',
  notes             text,
  is_refunded       boolean DEFAULT false,
  refund_amount     numeric(12,2) DEFAULT 0,
  refund_reason     text,
  printed_count     smallint DEFAULT 0,
  printed_at        timestamptz,
  issued_at         timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(branch_id, bill_number)
);

CREATE TABLE payments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  bill_id           uuid REFERENCES bills(id),
  order_id          uuid REFERENCES orders(id),
  shift_id          uuid,
  method            payment_method NOT NULL,
  amount            numeric(12,2) NOT NULL,
  reference_no      varchar(100),
  card_last4        varchar(4),
  upi_id            varchar(100),
  wallet_name       varchar(50),
  is_split          boolean DEFAULT false,
  status            varchar(20) DEFAULT 'success',
  notes             text,
  processed_at      timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

-- ─── INVENTORY ────────────────────────────────────────────────────────────────

CREATE TABLE units (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(50) NOT NULL,
  abbreviation      varchar(10) NOT NULL,
  is_base           boolean DEFAULT false
);

CREATE TABLE inventory_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES branches(id),
  category_id       uuid REFERENCES categories(id),
  name              varchar(200) NOT NULL,
  sku               varchar(50),
  barcode           varchar(50),
  description       text,
  unit_id           uuid REFERENCES units(id),
  purchase_unit_id  uuid REFERENCES units(id),
  conversion_factor numeric(10,4) DEFAULT 1,
  current_stock     numeric(12,3) DEFAULT 0,
  min_stock_level   numeric(12,3) DEFAULT 0,
  reorder_level     numeric(12,3) DEFAULT 0,
  max_stock_level   numeric(12,3),
  average_cost      numeric(12,4) DEFAULT 0,
  last_purchase_price numeric(12,4) DEFAULT 0,
  is_perishable     boolean DEFAULT false,
  expiry_days       smallint,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE suppliers (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(200) NOT NULL,
  contact_person    varchar(150),
  email             varchar(150),
  phone             varchar(15),
  gstin             varchar(15),
  pan               varchar(10),
  address           text,
  city              varchar(100),
  state             varchar(100),
  pincode           varchar(10),
  payment_terms     smallint DEFAULT 0,
  is_active         boolean DEFAULT true,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  supplier_id       uuid REFERENCES suppliers(id),
  po_number         varchar(30) NOT NULL,
  status            varchar(20) DEFAULT 'draft',
  order_date        date NOT NULL,
  expected_date     date,
  received_date     date,
  subtotal          numeric(12,2) DEFAULT 0,
  tax_amount        numeric(12,2) DEFAULT 0,
  total             numeric(12,2) DEFAULT 0,
  notes             text,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(branch_id, po_number)
);

CREATE TABLE purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id             uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  ordered_qty       numeric(12,3) NOT NULL,
  received_qty      numeric(12,3) DEFAULT 0,
  unit_id           uuid REFERENCES units(id),
  unit_price        numeric(12,4) NOT NULL,
  tax_rate          numeric(5,2) DEFAULT 0,
  tax_amount        numeric(12,2) DEFAULT 0,
  line_total        numeric(12,2) NOT NULL,
  notes             text
);

CREATE TABLE inventory_transactions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
  type              transaction_type NOT NULL,
  quantity          numeric(12,3) NOT NULL,
  unit_id           uuid REFERENCES units(id),
  unit_cost         numeric(12,4) DEFAULT 0,
  total_cost        numeric(12,2) DEFAULT 0,
  balance_after     numeric(12,3) NOT NULL,
  reference_type    varchar(50),
  reference_id      uuid,
  po_id             uuid REFERENCES purchase_orders(id),
  order_id          uuid REFERENCES orders(id),
  notes             text,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now()
);

-- ─── SHIFTS ───────────────────────────────────────────────────────────────────

CREATE TABLE shifts (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  shift_number      varchar(20) NOT NULL,
  status            shift_status DEFAULT 'open',
  opened_by         uuid NOT NULL REFERENCES users(id),
  closed_by         uuid REFERENCES users(id),
  opening_cash      numeric(12,2) DEFAULT 0,
  closing_cash      numeric(12,2) DEFAULT 0,
  expected_cash     numeric(12,2) DEFAULT 0,
  cash_difference   numeric(12,2) DEFAULT 0,
  total_sales       numeric(12,2) DEFAULT 0,
  total_orders      int DEFAULT 0,
  total_covers      int DEFAULT 0,
  cash_sales        numeric(12,2) DEFAULT 0,
  card_sales        numeric(12,2) DEFAULT 0,
  upi_sales         numeric(12,2) DEFAULT 0,
  wallet_sales      numeric(12,2) DEFAULT 0,
  credit_sales      numeric(12,2) DEFAULT 0,
  complimentary     numeric(12,2) DEFAULT 0,
  total_discount    numeric(12,2) DEFAULT 0,
  total_refund      numeric(12,2) DEFAULT 0,
  total_cgst        numeric(12,2) DEFAULT 0,
  total_sgst        numeric(12,2) DEFAULT 0,
  total_igst        numeric(12,2) DEFAULT 0,
  notes             text,
  opened_at         timestamptz DEFAULT now(),
  closed_at         timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(branch_id, shift_number)
);

CREATE TABLE shift_denominations (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id          uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  is_opening        boolean DEFAULT false,
  note_2000         int DEFAULT 0,
  note_500          int DEFAULT 0,
  note_200          int DEFAULT 0,
  note_100          int DEFAULT 0,
  note_50           int DEFAULT 0,
  note_20           int DEFAULT 0,
  note_10           int DEFAULT 0,
  coin_5            int DEFAULT 0,
  coin_2            int DEFAULT 0,
  coin_1            int DEFAULT 0,
  total_amount      numeric(12,2) GENERATED ALWAYS AS (
    (note_2000 * 2000) + (note_500 * 500) + (note_200 * 200) +
    (note_100 * 100) + (note_50 * 50) + (note_20 * 20) +
    (note_10 * 10) + (coin_5 * 5) + (coin_2 * 2) + (coin_1 * 1)
  ) STORED,
  created_at        timestamptz DEFAULT now()
);

-- ─── KDS (Kitchen Display System) ────────────────────────────────────────────

CREATE TABLE kds_displays (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              varchar(100) NOT NULL,
  station           varchar(50),
  categories        uuid[] DEFAULT '{}',
  display_color     varchar(7) DEFAULT '#f59e0b',
  bump_time_seconds int DEFAULT 300,
  is_active         boolean DEFAULT true,
  settings          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid REFERENCES tenants(id),
  branch_id         uuid REFERENCES branches(id),
  user_id           uuid REFERENCES users(id),
  action            varchar(100) NOT NULL,
  entity_type       varchar(100),
  entity_id         uuid,
  old_values        jsonb,
  new_values        jsonb,
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz DEFAULT now()
);

-- ─── OFFLINE SYNC QUEUE ───────────────────────────────────────────────────────

CREATE TABLE sync_queue (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES branches(id),
  device_id         varchar(100),
  entity_type       varchar(100) NOT NULL,
  entity_id         varchar(100) NOT NULL,
  operation         varchar(20) NOT NULL,
  payload           jsonb NOT NULL,
  synced            boolean DEFAULT false,
  synced_at         timestamptz,
  error             text,
  retry_count       smallint DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_users_tenant     ON users(tenant_id);
CREATE INDEX idx_users_branch     ON users(branch_id);
CREATE INDEX idx_branches_tenant  ON branches(tenant_id);
CREATE INDEX idx_tables_branch    ON tables(branch_id, status);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id, is_active);
CREATE INDEX idx_menu_items_cat   ON menu_items(category_id);
CREATE INDEX idx_orders_branch    ON orders(branch_id, status);
CREATE INDEX idx_orders_table     ON orders(table_id, status);
CREATE INDEX idx_orders_shift     ON orders(shift_id);
CREATE INDEX idx_orders_created   ON orders(branch_id, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_kds  ON order_items(order_id, kds_status);
CREATE INDEX idx_bills_branch     ON bills(branch_id);
CREATE INDEX idx_bills_order      ON bills(order_id);
CREATE INDEX idx_payments_bill    ON payments(bill_id);
CREATE INDEX idx_payments_shift   ON payments(shift_id);
CREATE INDEX idx_inv_transactions_item ON inventory_transactions(inventory_item_id, created_at DESC);
CREATE INDEX idx_inv_transactions_branch ON inventory_transactions(branch_id, created_at DESC);
CREATE INDEX idx_shifts_branch    ON shifts(branch_id, status);
CREATE INDEX idx_audit_tenant     ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_sync_queue_branch ON sync_queue(branch_id, synced, created_at);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','subscriptions','branches','users','table_sections','tables',
    'categories','menu_items','orders','order_items','bills','inventory_items',
    'suppliers','purchase_orders','shifts'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

-- ─── ORDER NUMBER SEQUENCE ────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS order_seq;
CREATE SEQUENCE IF NOT EXISTS bill_seq;
CREATE SEQUENCE IF NOT EXISTS po_seq;
CREATE SEQUENCE IF NOT EXISTS shift_seq;

-- ─── VIEWS ────────────────────────────────────────────────────────────────────

CREATE VIEW v_order_summary AS
SELECT
  o.id,
  o.tenant_id,
  o.branch_id,
  b.name AS branch_name,
  o.order_number,
  o.type,
  o.status,
  t.name AS table_name,
  ts.name AS section_name,
  o.covers,
  o.grand_total,
  o.paid_amount,
  o.total_tax,
  COUNT(oi.id) AS item_count,
  o.placed_at,
  o.billed_at,
  o.created_at
FROM orders o
LEFT JOIN branches b ON b.id = o.branch_id
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN table_sections ts ON ts.id = t.section_id
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.is_voided = false
GROUP BY o.id, b.name, t.name, ts.name;

CREATE VIEW v_daily_sales AS
SELECT
  branch_id,
  tenant_id,
  date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS sale_date,
  COUNT(*) AS total_bills,
  SUM(grand_total) AS gross_sales,
  SUM(discount_amount) AS total_discount,
  SUM(total_tax) AS total_tax,
  SUM(cgst_amount) AS total_cgst,
  SUM(sgst_amount) AS total_sgst,
  SUM(igst_amount) AS total_igst,
  SUM(grand_total) - SUM(discount_amount) AS net_sales
FROM bills
WHERE status NOT IN ('void', 'refunded')
GROUP BY branch_id, tenant_id, date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata');

CREATE VIEW v_kds_pending AS
SELECT
  oi.id AS order_item_id,
  oi.order_id,
  o.branch_id,
  o.tenant_id,
  o.order_number,
  o.type AS order_type,
  t.name AS table_name,
  ts.name AS section_name,
  oi.name AS item_name,
  oi.quantity,
  oi.notes,
  oi.kds_status,
  oi.created_at AS ordered_at,
  EXTRACT(EPOCH FROM (now() - oi.created_at))::int AS age_seconds
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN table_sections ts ON ts.id = t.section_id
WHERE oi.kds_status IN ('pending', 'acknowledged', 'preparing')
  AND oi.is_voided = false
  AND o.status NOT IN ('cancelled', 'billed');

CREATE VIEW v_stock_summary AS
SELECT
  ii.id,
  ii.tenant_id,
  ii.branch_id,
  ii.name,
  ii.sku,
  ii.current_stock,
  ii.min_stock_level,
  ii.reorder_level,
  u.abbreviation AS unit,
  CASE
    WHEN ii.current_stock <= 0 THEN 'out_of_stock'
    WHEN ii.current_stock <= ii.min_stock_level THEN 'low_stock'
    WHEN ii.current_stock <= ii.reorder_level THEN 'reorder'
    ELSE 'adequate'
  END AS stock_status,
  ii.average_cost,
  ii.current_stock * ii.average_cost AS stock_value
FROM inventory_items ii
LEFT JOIN units u ON u.id = ii.unit_id
WHERE ii.is_active = true;

-- ─── PASSWORD RESET TOKENS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  ip_address   VARCHAR(45),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- ─── TABLE SECTIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS table_sections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  sort_order  SMALLINT DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbl_sections_branch ON table_sections(branch_id);
CREATE INDEX IF NOT EXISTS idx_tbl_sections_tenant ON table_sections(tenant_id);
