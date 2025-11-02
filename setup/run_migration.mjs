/**
 * Выполнение миграции для обновления таблицы events
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function runMigration() {
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

    console.log('📝 Выполняю миграцию...');
    
    // Разделяем SQL на команды и выполняем
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

runMigration().catch(console.error);

