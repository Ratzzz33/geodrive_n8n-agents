#!/usr/bin/env node

/**
 * Deploy migration 0035: Fix decimal numbers in field changes
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
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('📦 Reading migration file...');
    const migrationPath = join(__dirname, 'migrations', '0035_fix_decimal_numbers_in_field_changes.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration 0035...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0035 deployed successfully!');
    console.log('');
    console.log('Парсер теперь корректно обрабатывает десятичные числа.');
    console.log('Теперь "7.4" будет извлекаться полностью, а не обрезаться до "7".');

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

