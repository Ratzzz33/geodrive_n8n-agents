#!/usr/bin/env node

/**
 * Deploy migration 0029: Fix ambiguous rentprog_id error
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
    const migrationPath = join(__dirname, 'migrations', '0029_fix_apply_history_ambiguous_rentprog_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration 0029...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0029 deployed successfully!');
    console.log('');
    console.log('Функция apply_history_changes обновлена с явными alias для таблиц.');
    console.log('Теперь триггер auto_process_history_trigger не будет падать на "ambiguous rentprog_id".');

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

