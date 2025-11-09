import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('📊 Применение миграции: error_analysis_cache...\n');

try {
  // Читаем SQL файл
  const migrationSQL = readFileSync('setup/create_error_analysis_cache.sql', 'utf-8');
  
  // Выполняем миграцию
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Таблица error_analysis_cache создана успешно');
  console.log('✅ Индексы созданы');
  console.log('✅ Триггер для updated_at установлен');
  
  // Проверяем результат
  const result = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'error_analysis_cache'
    ORDER BY ordinal_position
  `;
  
  console.log('\n📋 Структура таблицы:');
  result.forEach(col => {
    console.log(`   ${col.column_name}: ${col.data_type}`);
  });
  
} catch (error) {
  console.error('❌ Ошибка миграции:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

