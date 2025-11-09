import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    console.log('📦 Применение миграции 013_create_entity_timeline.sql...\n');
    
    // Читаем файл миграции
    const migrationPath = join(__dirname, 'migrations', '013_create_entity_timeline.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Выполняем миграцию
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Миграция успешно применена!\n');
    
    // Проверяем, что таблица создана
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'entity_timeline'
    `;
    
    if (tables.length > 0) {
      console.log('✅ Таблица entity_timeline создана');
    }
    
    // Проверяем views
    const views = await sql`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name IN ('entity_timeline_stats', 'entity_timeline_recent')
    `;
    
    console.log(`✅ Создано views: ${views.length}/2`);
    views.forEach(v => console.log(`   - ${v.table_name}`));
    
    // Проверяем индексы
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'entity_timeline'
    `;
    
    console.log(`\n✅ Создано индексов: ${indexes.length}`);
    indexes.forEach(idx => console.log(`   - ${idx.indexname}`));
    
    // Проверяем функцию очистки
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'cleanup_old_timeline_entries'
    `;
    
    if (functions.length > 0) {
      console.log('✅ Функция cleanup_old_timeline_entries создана');
    }
    
    console.log('\n🎉 Миграция завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    if (error.message.includes('already exists')) {
      console.log('⚠️  Таблица или view уже существует - это нормально');
    } else {
      throw error;
    }
  } finally {
    await sql.end();
  }
}

applyMigration();

