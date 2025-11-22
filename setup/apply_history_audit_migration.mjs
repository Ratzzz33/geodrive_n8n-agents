#!/usr/bin/env node

/**
 * Apply migration 0036: Create history_audit table
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 30
  });

  try {
    console.log('📋 Применение миграции 0036: создание таблицы history_audit...\n');

    const migrationSQL = readFileSync('setup/migrations/0036_create_history_audit_table.sql', 'utf8');
    
    // Выполняем весь SQL файл целиком
    console.log('Выполняю миграцию...\n');
    try {
      await sql.unsafe(migrationSQL);
      console.log('✅ Миграция выполнена успешно\n');
    } catch (error) {
      // Игнорируем ошибки "already exists"
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️ Некоторые объекты уже существуют, продолжаю...\n');
      } else {
        throw error;
      }
    }

    console.log('✅ Миграция применена успешно!');
    console.log('\n📊 Проверка таблицы history_audit...\n');
    
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'history_audit'
      )
    `;

    if (tableExists[0].exists) {
      console.log('✅ Таблица history_audit создана');
      
      const count = await sql`SELECT COUNT(*) as count FROM history_audit`;
      console.log(`📊 Записей в history_audit: ${count[0].count}`);
    } else {
      console.log('❌ Таблица history_audit не найдена');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

