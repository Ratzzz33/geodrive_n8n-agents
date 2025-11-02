/**
 * Скрипт для обновления таблицы events в Neon PostgreSQL
 * Добавляет поле processed и unique constraint для обработки дубликатов
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Получаем переменные окружения или используем дефолтные значения
const NEON_HOST = process.env.NEON_HOST || 'ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech';
const NEON_PORT = process.env.NEON_PORT || 5432;
const NEON_DATABASE = process.env.NEON_DATABASE || 'neondb';
const NEON_USER = process.env.NEON_USER || 'neondb_owner';
const NEON_PASSWORD = process.env.NEON_PASSWORD || 'npg_cHIT9Kxfk1Am';

// Строка подключения
const CONNECTION_STRING = `postgresql://${NEON_USER}:${NEON_PASSWORD}@${NEON_HOST}:${NEON_PORT}/${NEON_DATABASE}?sslmode=require`;

async function updateEventsTable() {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Подключено к Neon PostgreSQL');

    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'update_events_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Разделяем SQL на команды и выполняем
    console.log('📝 Выполняю миграцию...');
    
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('COMMENT'));

    for (const command of commands) {
      if (command.length > 0) {
        try {
          await client.query(command);
          console.log(`✅ Выполнено: ${command.substring(0, 60).replace(/\n/g, ' ')}...`);
        } catch (error) {
          // Игнорируем ошибки типа "already exists" или "duplicate"
          if (error.code === '42710' || error.code === '23505' || 
              error.message?.includes('already exists') || 
              error.message?.includes('duplicate') ||
              error.message?.includes('does not exist')) {
            console.log(`⚠️  Пропущено (уже существует или не применимо): ${command.substring(0, 60).replace(/\n/g, ' ')}...`);
          } else {
            console.error(`❌ Ошибка:`, error.message);
            console.error(`Команда: ${command.substring(0, 100)}...`);
            // Не прерываем выполнение, продолжаем
          }
        }
      }
    }

    // Проверяем результат
    const checkResult = await client.query(`
      SELECT 
        column_name, 
        data_type,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'processed'
    `);

    const constraintResult = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'events' 
      AND constraint_name = 'events_branch_type_ext_id_unique'
    `);

    console.log('\n📊 Результаты миграции:');
    if (checkResult.rows.length > 0) {
      console.log(`   ✅ Поле 'processed' добавлено`);
    } else {
      console.log(`   ⚠️  Поле 'processed' не найдено`);
    }

    if (constraintResult.rows.length > 0) {
      console.log(`   ✅ Unique constraint добавлен`);
    } else {
      console.log(`   ⚠️  Unique constraint не найден`);
    }

    console.log('\n✅ Миграция завершена!');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateEventsTable().catch(console.error);
