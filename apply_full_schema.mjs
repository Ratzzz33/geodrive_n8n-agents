import postgres from 'postgres';
import fs from 'fs';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔄 Применяю полную схему БД...');

try {
  // Читаем файл схемы
  const schema = fs.readFileSync('sql/conversations_schema.sql', 'utf8');
  
  console.log('📄 Читаю sql/conversations_schema.sql...');
  
  // Применяем схему
  console.log('🔨 Применяю схему...');
  await sql.unsafe(schema);
  
  console.log('✅ Схема успешно применена!');
  
  // Проверка: показать созданные таблицы
  console.log('\n📊 Созданные таблицы:');
  const tables = await sql.unsafe(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  tables.forEach(t => {
    console.log(`   - ${t.tablename}`);
  });

  // Проверка: показать индексы на conversations
  console.log('\n📊 Индексы на таблице conversations:');
  const indexes = await sql.unsafe(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'conversations'
    ORDER BY indexname
  `);
  
  indexes.forEach(idx => {
    console.log(`   - ${idx.indexname}`);
  });

  console.log('\n✅ Миграция завершена успешно!');
  
} catch (error) {
  console.error('❌ Ошибка при применении схемы:', error);
  process.exit(1);
} finally {
  await sql.end();
}

