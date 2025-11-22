#!/usr/bin/env node

/**
 * Применить миграцию для таблиц контента сайта
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('📋 Применение миграции для таблиц контента сайта...\n');
  
  try {
    // Прочитать SQL файл
    const sqlFile = join(__dirname, '..', 'sql', 'website_content_schema.sql');
    const sqlContent = readFileSync(sqlFile, 'utf-8');
    
    // Выполнить миграцию
    await sql.unsafe(sqlContent);
    
    console.log('✅ Миграция успешно применена!\n');
    
    // Проверить созданные таблицы
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('website_pages', 'website_content_chunks', 'website_scraping_log')
      ORDER BY table_name
    `;
    
    console.log('📊 Созданные таблицы:');
    for (const table of tables) {
      console.log(`  - ${table.table_name}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка применения миграции:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

