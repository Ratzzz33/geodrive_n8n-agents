#!/usr/bin/env node

/**
 * Deploy migration 0034: Add error_code field to history table
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
    const migrationPath = join(__dirname, 'migrations', '0034_add_error_code_to_history.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration 0034...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0034 deployed successfully!');
    console.log('');
    console.log('Добавлено поле error_code в таблицу history.');
    console.log('Теперь можно отслеживать ошибки обработки по уникальным кодам.');
    console.log('');
    console.log('Коды ошибок (с префиксом HISTORY_ERR_):');
    console.log('  HISTORY_ERR_EMPTY_DESCRIPTION - пустое описание');
    console.log('  HISTORY_ERR_PARSE_EXCEPTION - SQL ошибка при парсинге');
    console.log('  HISTORY_ERR_PARSE_FAILED - не удалось распарсить (entity не найден)');
    console.log('  HISTORY_ERR_APPLY_EXCEPTION - SQL ошибка при применении');
    console.log('  HISTORY_ERR_ENTITY_NOT_FOUND - сущность не найдена в БД');
    console.log('');
    console.log('Если error_code = NULL, значит обработка прошла успешно!');
    console.log('Просто скопируйте код ошибки (например: HISTORY_ERR_ENTITY_NOT_FOUND) для быстрого поиска!');

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

