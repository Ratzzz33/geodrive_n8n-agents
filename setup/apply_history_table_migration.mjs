import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  console.log('📦 Применяем миграцию для таблицы history...\n');
  
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Читаем SQL файл
    const sqlFile = join(projectRoot, 'setup', 'create_history_table.sql');
    const sqlContent = readFileSync(sqlFile, 'utf-8');
    
    console.log('🔄 Выполняем SQL миграцию...');
    
    // Выполняем миграцию
    await sql.unsafe(sqlContent);
    
    console.log('✅ Таблица history создана!');
    console.log('\nСтруктура таблицы:');
    console.log('  - id: BIGSERIAL PRIMARY KEY');
    console.log('  - ts: TIMESTAMPTZ (время добавления в таблицу)');
    console.log('  - branch: TEXT (филиал)');
    console.log('  - operation_type: TEXT (тип операции)');
    console.log('  - operation_id: TEXT (ID операции в RentProg)');
    console.log('  - description: TEXT (описание)');
    console.log('  - entity_type: TEXT (car/booking/client/payment)');
    console.log('  - entity_id: TEXT (ID сущности)');
    console.log('  - user_name: TEXT (имя пользователя)');
    console.log('  - created_at: TIMESTAMPTZ (время операции)');
    console.log('  - raw_data: JSONB (полные данные)');
    console.log('  - matched: BOOLEAN (найдено в events)');
    console.log('  - processed: BOOLEAN (обработано)');
    console.log('  - notes: TEXT (заметки для анализа)');
    
    console.log('\n✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration();

