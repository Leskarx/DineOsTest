/**
 * Database Seeder — run with: npm run db:seed
 * Seeds demo tenant, plans, default GST rates, sample menu
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'dinestayadmin',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'dinestay',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
});

async function seed() {
  await dataSource.initialize();
  console.log('Connected to DB. Seeding...');

  const em = dataSource.manager;

  // ─── Superadmin ────────────────────────────────────────────────────────────
  // Create a hidden "system" tenant to anchor the superadmin user row
  // (tenant_id is NOT NULL so we need a real UUID row)
  const saEmail    = process.env.SUPERADMIN_EMAIL    || 'superadmin@dinestay.app';
  const saPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
  const [sysTenant] = await em.query(`
    INSERT INTO tenants (name, slug, email, is_active)
    VALUES ('_system', '_system', $1, false)
    ON CONFLICT (slug) DO UPDATE SET email = EXCLUDED.email
    RETURNING id
  `, [saEmail]);
  const saHash = await bcrypt.hash(saPassword, 12);
  await em.query(`
    INSERT INTO users (tenant_id, email, password_hash, first_name, role)
    VALUES ($1, $2, $3, 'Superadmin', 'superadmin')
    ON CONFLICT DO NOTHING
  `, [sysTenant.id, saEmail, saHash]);
  console.log(`✅ Superadmin created: ${saEmail} / ${saPassword}`);

  // ─── Plans ─────────────────────────────────────────────────────────────────
  await em.query(`
    INSERT INTO plans (code, name, description, price_monthly, price_annual, max_branches, max_users, max_menu_items, features)
    VALUES
      ('starter',    'Starter',    'Single outlet',     2999,  29990,  1,  10,  200,  '["pos","billing","gst","kds","inventory","shifts","reports_basic","thermal_print","offline_sync"]'),
      ('growth',     'Growth',     'Multi-branch',      7999,  79990,  5,  50,  1000, '["pos","billing","gst","kds","inventory","shifts","reports_advanced","thermal_print","offline_sync","multi_branch","hq_dashboard","inventory_advanced","employee_mgmt"]'),
      ('enterprise', 'Enterprise', 'Unlimited',         0,     0,     -1, -1, -1,   '["all"]')
    ON CONFLICT (code) DO NOTHING
  `);

  // ─── Demo Tenant ───────────────────────────────────────────────────────────
  const [tenant] = await em.query(`
    INSERT INTO tenants (name, slug, email, phone, gstin, address)
    VALUES ('Spice Garden Restaurant', 'spice-garden-demo', 'demo@spicegarden.in', '+919876543210', '27AAPFU0939F1ZV', 'Mumbai, Maharashtra')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const tenantId = tenant.id;

  // ─── HQ Branch ─────────────────────────────────────────────────────────────
  const [branch] = await em.query(`
    INSERT INTO branches (tenant_id, name, code, is_hq, address)
    VALUES ($1, 'Main Branch', 'HQ', true, 'Mumbai, Maharashtra')
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [tenantId]);
  const branchId = branch.id;

  // ─── Owner User ────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Demo@1234', 12);
  await em.query(`
    INSERT INTO users (tenant_id, branch_id, email, password_hash, first_name, last_name, role)
    VALUES ($1, $2, 'demo@spicegarden.in', $3, 'Admin', 'User', 'owner')
    ON CONFLICT (tenant_id, email) DO NOTHING
  `, [tenantId, branchId, hash]);

  // ─── Subscription ──────────────────────────────────────────────────────────
  const [plan] = await em.query(`SELECT id FROM plans WHERE code = 'starter'`);
  await em.query(`
    INSERT INTO subscriptions (tenant_id, plan_id, status, trial_ends_at)
    VALUES ($1, $2, 'trial', NOW() + INTERVAL '14 days')
    ON CONFLICT DO NOTHING
  `, [tenantId, plan.id]);

  // ─── GST Rates ─────────────────────────────────────────────────────────────
  await em.query(`
    INSERT INTO gst_rates (tenant_id, name, rate, hsn_code)
    VALUES
      ($1, 'Exempt', 0, '9963'),
      ($1, 'GST 5%', 5, '9963'),
      ($1, 'GST 12%', 12, '9963'),
      ($1, 'GST 18%', 18, '9963'),
      ($1, 'GST 28%', 28, '2203')
    ON CONFLICT DO NOTHING
  `, [tenantId]);

  // ─── Categories ────────────────────────────────────────────────────────────
  const categories = await em.query(`
    INSERT INTO categories (tenant_id, branch_id, name, sort_order)
    VALUES
      ($1, $2, 'Starters', 1),
      ($1, $2, 'Main Course', 2),
      ($1, $2, 'Breads', 3),
      ($1, $2, 'Beverages', 4),
      ($1, $2, 'Desserts', 5)
    ON CONFLICT DO NOTHING
    RETURNING id, name
  `, [tenantId, branchId]);

  const catMap: Record<string, string> = {};
  for (const c of categories) catMap[c.name] = c.id;

  // ─── Sample Menu Items ─────────────────────────────────────────────────────
  const menuItems = [
    { name: 'Paneer Tikka',         cat: 'Starters',    price: 320, isVeg: true,  gst: 5 },
    { name: 'Chicken Malai Tikka',  cat: 'Starters',    price: 380, isVeg: false, gst: 5 },
    { name: 'Dal Makhani',          cat: 'Main Course', price: 280, isVeg: true,  gst: 5 },
    { name: 'Butter Chicken',       cat: 'Main Course', price: 380, isVeg: false, gst: 5 },
    { name: 'Paneer Butter Masala', cat: 'Main Course', price: 320, isVeg: true,  gst: 5 },
    { name: 'Garlic Naan',          cat: 'Breads',      price: 60,  isVeg: true,  gst: 5 },
    { name: 'Tandoori Roti',        cat: 'Breads',      price: 40,  isVeg: true,  gst: 5 },
    { name: 'Mango Lassi',          cat: 'Beverages',   price: 120, isVeg: true,  gst: 5 },
    { name: 'Fresh Lime Soda',      cat: 'Beverages',   price: 80,  isVeg: true,  gst: 5 },
    { name: 'Gulab Jamun',          cat: 'Desserts',    price: 100, isVeg: true,  gst: 5 },
    { name: 'Kingfisher Beer (330ml)', cat: 'Beverages',price: 180, isVeg: true,  gst: 18 },
  ];

  for (const item of menuItems) {
    await em.query(`
      INSERT INTO menu_items (tenant_id, branch_id, category_id, name, price, gst_rate, is_veg, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT DO NOTHING
    `, [tenantId, branchId, catMap[item.cat], item.name, item.price, item.gst, item.isVeg]);
  }

  // ─── Tables ────────────────────────────────────────────────────────────────
  for (let i = 1; i <= 12; i++) {
    await em.query(`
      INSERT INTO tables (tenant_id, branch_id, table_number, capacity)
      VALUES ($1, $2, $3, 4)
      ON CONFLICT DO NOTHING
    `, [tenantId, branchId, `T${i}`]);
  }

  console.log('✅ Seed complete!');
  console.log(`   Tenant ID: ${tenantId}`);
  console.log(`   Branch ID: ${branchId}`);
  console.log(`   Login: demo@spicegarden.in / Demo@1234`);

  await dataSource.destroy();
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
