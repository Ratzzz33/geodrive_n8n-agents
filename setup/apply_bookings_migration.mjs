#!/usr/bin/env node
/**
 * Применение миграции для добавления полей в таблицу bookings
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔧 Применение миграции для таблицы bookings...\n');

    // Читаем SQL файл
    const migrationPath = path.join(__dirname, 'add_bookings_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Разбиваем на отдельные команды
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Найдено команд: ${statements.length}\n`);

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      try {
        // Извлекаем название операции для логирования
        const match = statement.match(/ALTER TABLE bookings ADD COLUMN IF NOT EXISTS (\w+)/i) ||
                     statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i) ||
                     statement.match(/COMMENT ON COLUMN bookings\.(\w+)/i);
        
        const operationName = match ? match[1] : 'operation';

        await sql.unsafe(statement);
        console.log(`✅ ${operationName}`);
        successCount++;
      } catch (err) {
        if (err.message.includes('already exists')) {
          skipCount++;
        } else {
          console.error(`❌ Ошибка: ${err.message}`);
        }
      }
    }

    console.log(`\n📊 Результат:`);
    console.log(`   ✅ Успешно: ${successCount}`);
    console.log(`   ⏭️  Пропущено (уже существует): ${skipCount}`);

    // Проверяем схему таблицы
    console.log(`\n🔍 Проверка схемы таблицы bookings...\n`);
    
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position
    `;

    console.log(`📋 Поля таблицы bookings (${columns.length}):\n`);
    
    const newFields = [
      'start_date_formatted', 'end_date_formatted',
      'client_name', 'client_category',
      'car_name', 'car_code',
      'location_start', 'location_end',
      'total', 'deposit', 'rental_cost', 'days',
      'in_rent', 'archive',
      'start_worker_id', 'end_worker_id', 'responsible',
      'description', 'source'
    ];

    newFields.forEach(field => {
      const col = columns.find(c => c.column_name === field);
      if (col) {
        console.log(`   ✅ ${field.padEnd(25)} ${col.data_type}`);
      } else {
        console.log(`   ❌ ${field.padEnd(25)} НЕ НАЙДЕНО!`);
      }
    });

    console.log(`\n✅ Миграция завершена!`);
    console.log(`🚀 Теперь workflow сможет быстро сохранять данные в БД\n`);

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(err => {
  console.error('❌ Ошибка выполнения:', err.message);
  process.exit(1);
});

