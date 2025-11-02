/**
 * Выполнение миграции для обновления таблицы events
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function runMigration() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('✅ Подключено к Neon PostgreSQL');

    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'update_events_table.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Выполняю миграцию...');
    
    // Разделяем SQL на команды и выполняем
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('COMMENT'));

    for (const command of commands) {
      if (command.length > 0) {
        try {
          await sql.unsafe(command);
          console.log(`✅ Выполнено: ${command.substring(0, 60).replace(/\n/g, ' ')}...`);
        } catch (error: any) {
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
    const checkResult = await sql`
      SELECT 
        column_name, 
        data_type,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'processed'
    `;

    const constraintResult = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'events' 
      AND constraint_name = 'events_branch_type_ext_id_unique'
    `;

    console.log('\n📊 Результаты миграции:');
    if (checkResult.length > 0) {
      console.log(`   ✅ Поле 'processed' добавлено`);
    } else {
      console.log(`   ⚠️  Поле 'processed' не найдено`);
    }

    if (constraintResult.length > 0) {
      console.log(`   ✅ Unique constraint добавлен`);
    } else {
      console.log(`   ⚠️  Unique constraint не найден`);
    }

    console.log('\n✅ Миграция завершена!');

  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration().catch(console.error);

