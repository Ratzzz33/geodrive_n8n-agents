#!/usr/bin/env node
/**
 * Применение миграции для исправления dynamic_upsert_entity
 * Дата: 2025-11-09
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка .env файла
const envPath = join(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
  console.log('✅ .env файл загружен\n');
} catch (error) {
  console.log('⚠️  .env файл не найден, используем переменные окружения\n');
}

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Применение миграции dynamic_upsert_entity             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Читаем SQL файл
    const migrationPath = join(__dirname, 'migrations', 'fix_dynamic_upsert_array_to_jsonb.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Читаем миграцию...');
    console.log(`   Файл: ${migrationPath}\n`);

    console.log('🔄 Применяем миграцию...');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);

    console.log('✅ Миграция успешно применена!\n');

    // Проверяем что функция обновлена
    const result = await sql`
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments,
        obj_description(p.oid, 'pg_proc') as description
      FROM pg_proc p
      WHERE p.proname = 'dynamic_upsert_entity'
    `;

    if (result.length > 0) {
      console.log('📋 Информация о функции:');
      console.log(`   Имя: ${result[0].function_name}`);
      console.log(`   Аргументы: ${result[0].arguments}`);
      console.log(`   Описание: ${result[0].description || '(нет)'}\n`);
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ ГОТОВО!                             ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('Теперь функция dynamic_upsert_entity корректно обрабатывает:');
    console.log('  ✅ integer[] → jsonb (массивы)');
    console.log('  ✅ Определение типа колонки из JSON');
    console.log('  ✅ Автоматическое преобразование типов\n');

  } catch (error) {
    console.error('\n❌ Ошибка при применении миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

