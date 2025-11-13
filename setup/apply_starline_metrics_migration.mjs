/**
 * Применение миграции для таблицы starline_metrics
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не установлен в переменных окружения');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    console.log('📋 Применение миграции 0022_create_starline_metrics.sql...');
    
    const migrationPath = join(__dirname, 'migrations', '0022_create_starline_metrics.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Выполняем SQL по частям (разделяем по ;)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.length > 0) {
        await sql.unsafe(statement);
      }
    }
    
    console.log('✅ Миграция применена успешно!');
    
    // Проверяем, что таблица создана
    try {
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'starline_metrics'
        )
      `;
      
      if (tableExists[0] && tableExists[0].exists) {
        console.log('✅ Таблица starline_metrics создана');
      } else {
        console.warn('⚠️ Таблица starline_metrics не найдена');
      }
    } catch (checkError) {
      console.warn('⚠️ Не удалось проверить существование таблицы:', checkError.message);
    }
    
  } catch (error) {
    console.error('❌ Ошибка применения миграции:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

