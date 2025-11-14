#!/usr/bin/env node
/**
 * Применить миграцию для добавления VIEW с русскими названиями статусов
 * 
 * Что делает:
 * 1. Создает таблицу gps_status_labels (справочник)
 * 2. Заполняет справочник русскими названиями
 * 3. Создает VIEW gps_tracking_with_labels
 * 4. Добавляет индексы для производительности
 * 
 * Использование:
 *   node setup/apply_gps_labels_migration.mjs
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string из переменных окружения или дефолт
const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('🚀 Применение миграции GPS статусов...\n');

// Создать подключение
const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // Прочитать SQL файл миграции
  const migrationPath = path.join(__dirname, '..', 'migrations', 'add_gps_status_labels.sql');
  console.log(`📂 Читаем миграцию: ${migrationPath}`);
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Применить миграцию
  console.log('⚙️  Применяем миграцию...');
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Миграция успешно применена!\n');
  
  // Проверить результаты
  console.log('🔍 Проверка результатов:\n');
  
  // 1. Проверить справочную таблицу
  console.log('1️⃣  Справочная таблица gps_status_labels:');
  const labels = await sql`SELECT code, label, emoji, category FROM gps_status_labels ORDER BY code`;
  console.table(labels);
  
  // 2. Проверить VIEW
  console.log('\n2️⃣  Проверка VIEW (первые 5 записей):');
  const viewData = await sql`
    SELECT 
      car_id,
      status,
      status_label,
      status_emoji,
      status_display,
      speed,
      battery_voltage
    FROM gps_tracking_with_labels
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  console.table(viewData);
  
  // 3. Статистика по статусам
  console.log('\n3️⃣  Статистика по статусам:');
  const stats = await sql`
    SELECT 
      status_display,
      COUNT(*) as count
    FROM gps_tracking_with_labels
    GROUP BY status_display, status
    ORDER BY count DESC
  `;
  console.table(stats);
  
  console.log('\n✨ Готово! Теперь можно использовать VIEW в коде.\n');
  console.log('📖 Документация: docs/GPS_VIEW_USAGE.md\n');
  
} catch (error) {
  console.error('❌ Ошибка при применении миграции:');
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

