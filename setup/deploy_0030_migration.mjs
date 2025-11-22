#!/usr/bin/env node

/**
 * Deploy migration 0030: Add field change parsing
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
    const migrationPath = join(__dirname, 'migrations', '0030_parse_field_changes_in_history.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration 0030...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0030 deployed successfully!');
    console.log('');
    console.log('Теперь парсер истории извлекает изменения полей из description.');
    console.log('Изменения типа "изменил car_class с Средний на Эконом" будут применяться к таблице cars.');

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

