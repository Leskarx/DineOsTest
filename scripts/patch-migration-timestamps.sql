-- ─────────────────────────────────────────────────────────────────────────────
--  One-time patch: update typeorm_migrations records to match renamed files.
--  Run this ONCE on any database that ran migrations before 2026-05-16.
--
--  Usage:
--    psql -U dinestayadmin -d dinestay -f scripts/patch-migration-timestamps.sql
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE typeorm_migrations SET timestamp = 1704067200000, name = 'InitialSchema1704067200000'    WHERE name = 'InitialSchema1700000000000';
UPDATE typeorm_migrations SET timestamp = 1706745600000, name = 'PasswordResetTokens1706745600000' WHERE name = 'PasswordResetTokens1700000000001';
UPDATE typeorm_migrations SET timestamp = 1709251200000, name = 'HotelModule1709251200000'       WHERE name = 'HotelModule1700000000002';
UPDATE typeorm_migrations SET timestamp = 1711929600000, name = 'SyncMissingColumns1711929600000' WHERE name = 'SyncMissingColumns1700000000003';
UPDATE typemap_migrations SET timestamp = 1714521600000, name = 'FixRemainingColumns1714521600000' WHERE name = 'FixRemainingColumns1700000000004';
UPDATE typeorm_migrations SET timestamp = 1717200000000, name = 'FixOrdersSchema1717200000000'   WHERE name = 'FixOrdersSchema1700000000005';
UPDATE typeorm_migrations SET timestamp = 1719792000000, name = 'CreateViews1719792000000'       WHERE name = 'CreateViews1700000000006';
UPDATE typeorm_migrations SET timestamp = 1722470400000, name = 'FixPaymentsTable1722470400000'  WHERE name = 'FixPaymentsTable1700000000007';
