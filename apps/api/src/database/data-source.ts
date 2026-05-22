/**
 * TypeORM DataSource for CLI migrations.
 * Usage:
 *   npm run db:migrate          — run pending migrations
 *   npm run db:migrate:revert   — revert last migration
 *   typeorm migration:generate -d src/database/data-source.ts -n <Name>
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'dinestayadmin',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'dinestay',
  synchronize: false,
  logging: false,
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  // rejectUnauthorized: true validates the server certificate (required for managed DBs).
  // Set DB_SSL_CA to the path of your CA cert file if using a self-signed cert.
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA ? require('fs').readFileSync(process.env.DB_SSL_CA).toString() : undefined }
    : false,
});
