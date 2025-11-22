#!/usr/bin/env node

/**
 * Deploy migration 0031: Fix ambiguous rentprog_id in sync_booking_car_id_from_car
 * Runs directly against Neon PostgreSQL
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function deployMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📦 Reading migration file...');
    const migrationPath = join(__dirname, 'migrations', '0031_fix_sync_booking_ambiguous_rentprog_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration 0031...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0031 deployed successfully!');
    console.log('');
    console.log('Функция sync_booking_car_id_from_car обновлена с явными alias.');
    console.log('Триггер на таблице cars больше не падает на "ambiguous rentprog_id".');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

deployMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

