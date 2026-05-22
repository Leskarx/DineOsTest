/**
 * Standalone migration runner — compiled into dist/ and called by the
 * deploy pipeline BEFORE the API container starts serving traffic.
 *
 * Usage (production):
 *   node dist/database/run-migrations.js
 */
import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function runMigrations() {
  console.log('[migrate] Connecting to database…');
  await AppDataSource.initialize();

  const pending = await AppDataSource.showMigrations();
  if (!pending) {
    console.log('[migrate] No pending migrations — schema is up to date.');
    await AppDataSource.destroy();
    return;
  }

  console.log('[migrate] Running pending migrations…');
  const ran = await AppDataSource.runMigrations({ transaction: 'each' });
  ran.forEach((m) => console.log(`[migrate] ✓ ${m.name}`));
  console.log(`[migrate] Done — ${ran.length} migration(s) applied.`);

  await AppDataSource.destroy();
}

runMigrations().catch((err) => {
  console.error('[migrate] FAILED:', err.message ?? err);
  process.exit(1);
});
