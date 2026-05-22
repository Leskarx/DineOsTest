import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelModule1709251200000 implements MigrationInterface {
  name = 'HotelModule1709251200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Room Types ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_room_types (
        id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id       UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        description     TEXT,
        base_rate       NUMERIC(12,2) NOT NULL DEFAULT 0,
        max_occupancy   SMALLINT    NOT NULL DEFAULT 2,
        amenities       JSONB       NOT NULL DEFAULT '[]',
        total_rooms     SMALLINT    NOT NULL DEFAULT 0,
        is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hrt_tenant_branch ON hotel_room_types(tenant_id, branch_id)`);

    // ── Room Status Enum ───────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE room_status AS ENUM (
          'available','occupied','reserved','cleaning','maintenance','out_of_order'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Rooms ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_rooms (
        id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id           UUID         NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        room_type_id        UUID         NOT NULL REFERENCES hotel_room_types(id),
        room_number         VARCHAR(20)  NOT NULL,
        floor               SMALLINT     NOT NULL DEFAULT 1,
        status              room_status  NOT NULL DEFAULT 'available',
        amenities_override  JSONB,
        notes               TEXT,
        is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, branch_id, room_number)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hr_tenant_status ON hotel_rooms(tenant_id, status)`);

    // ── ID Type & Gender Enums ─────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE id_type AS ENUM ('aadhaar','passport','driving_license','voter_id','pan','other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE guest_gender AS ENUM ('male','female','other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Guests ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_guests (
        id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         VARCHAR(150) NOT NULL,
        phone        VARCHAR(20)  NOT NULL,
        email        VARCHAR(200),
        id_type      id_type,
        id_number    VARCHAR(50),
        nationality  VARCHAR(60)  DEFAULT 'India',
        address      TEXT,
        city         VARCHAR(80),
        state        VARCHAR(60),
        pincode      VARCHAR(10),
        dob          DATE,
        gender       guest_gender,
        total_stays  INT         NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hg_tenant ON hotel_guests(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hg_phone  ON hotel_guests(tenant_id, phone)`);

    // ── Reservation Status & Source Enums ──────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE reservation_status AS ENUM (
          'confirmed','checked_in','checked_out','cancelled','no_show'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE booking_source AS ENUM ('walk_in','phone','ota','website','agent');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Reservations ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_reservations (
        id                  UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id           UUID               NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id           UUID               NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        room_id             UUID               NOT NULL REFERENCES hotel_rooms(id),
        primary_guest_id    UUID               NOT NULL REFERENCES hotel_guests(id),
        num_adults          SMALLINT           NOT NULL DEFAULT 1,
        num_children        SMALLINT           NOT NULL DEFAULT 0,
        check_in_date       DATE               NOT NULL,
        check_out_date      DATE               NOT NULL,
        actual_check_in     TIMESTAMPTZ,
        actual_check_out    TIMESTAMPTZ,
        status              reservation_status NOT NULL DEFAULT 'confirmed',
        rate_per_night      NUMERIC(12,2)      NOT NULL,
        num_nights          SMALLINT           NOT NULL,
        subtotal            NUMERIC(12,2)      NOT NULL,
        tax_amount          NUMERIC(12,2)      NOT NULL DEFAULT 0,
        total_amount        NUMERIC(12,2)      NOT NULL,
        advance_paid        NUMERIC(12,2)      NOT NULL DEFAULT 0,
        balance_due         NUMERIC(12,2)      NOT NULL,
        source              booking_source     NOT NULL DEFAULT 'walk_in',
        booking_ref         VARCHAR(100),
        special_requests    TEXT,
        notes               TEXT,
        cancelled_at        TIMESTAMPTZ,
        cancel_reason       TEXT,
        created_by_id       UUID,
        created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hres_tenant_branch   ON hotel_reservations(tenant_id, branch_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hres_check_in_date   ON hotel_reservations(tenant_id, check_in_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hres_status          ON hotel_reservations(tenant_id, status)`);

    // ── Charge Type Enum ───────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE folio_charge_type AS ENUM (
          'room_charge','restaurant','laundry','minibar','telephone',
          'service','tax','advance','discount','settlement'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Folio Charges ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_folio_charges (
        id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID              NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reservation_id  UUID              NOT NULL REFERENCES hotel_reservations(id) ON DELETE CASCADE,
        description     VARCHAR(255)      NOT NULL,
        amount          NUMERIC(12,2)     NOT NULL,
        charge_type     folio_charge_type NOT NULL,
        reference_id    VARCHAR(100),
        date            DATE              NOT NULL DEFAULT CURRENT_DATE,
        created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hfc_reservation ON hotel_folio_charges(tenant_id, reservation_id)`);

    // ── Housekeeping Enums ─────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE hk_task_type AS ENUM (
          'checkout_clean','stayover','turndown','inspection','maintenance'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE hk_status AS ENUM ('pending','in_progress','done','skipped');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE hk_priority AS ENUM ('normal','high','urgent');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Housekeeping Tasks ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_housekeeping_tasks (
        id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        branch_id       UUID         NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        room_id         UUID         NOT NULL REFERENCES hotel_rooms(id),
        reservation_id  UUID         REFERENCES hotel_reservations(id),
        task_type       hk_task_type NOT NULL,
        status          hk_status    NOT NULL DEFAULT 'pending',
        priority        hk_priority  NOT NULL DEFAULT 'normal',
        notes           TEXT,
        scheduled_for   DATE         NOT NULL DEFAULT CURRENT_DATE,
        assigned_to     UUID,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hhk_tenant_date ON hotel_housekeeping_tasks(tenant_id, branch_id, scheduled_for)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hhk_room        ON hotel_housekeeping_tasks(room_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_housekeeping_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_folio_charges`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_reservations`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_guests`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_room_types`);
    await queryRunner.query(`DROP TYPE IF EXISTS hk_priority, hk_status, hk_task_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS folio_charge_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS booking_source, reservation_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS guest_gender, id_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS room_status`);
  }
}
