import postgres from 'postgres';
import fs from 'fs';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔄 Применяю миграцию для оптимизации Umnico...');

try {
  // Добавить поле last_message_preview
  console.log('1. Добавляю поле last_message_preview...');
  await sql.unsafe('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT');
  console.log('   ✅ Поле добавлено');

  // Добавить комментарий
  console.log('2. Добавляю комментарий...');
  await sql.unsafe("COMMENT ON COLUMN conversations.last_message_preview IS 'Кеш текста последнего сообщения для быстрого сравнения при инкрементальной синхронизации'");
  console.log('   ✅ Комментарий добавлен');

  // Создать индекс для быстрой фильтрации активных чатов
  console.log('3. Создаю индекс idx_conversations_recent...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_conversations_recent 
    ON conversations(last_message_at DESC) 
    WHERE last_message_at > NOW() - INTERVAL '1 hour'
  `);
  console.log('   ✅ Индекс создан');

  // Создать индекс для поиска по превью
  console.log('4. Создаю индекс idx_conversations_preview...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_conversations_preview 
    ON conversations(last_message_preview) 
    WHERE last_message_preview IS NOT NULL
  `);
  console.log('   ✅ Индекс создан');

  // Проверка: показать созданные индексы
  console.log('\n📊 Индексы на таблице conversations:');
  const indexes = await sql.unsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'conversations'
    ORDER BY indexname
  `);
  
  indexes.forEach(idx => {
    console.log(`   - ${idx.indexname}`);
  });

  console.log('\n✅ Миграция успешно применена!');
  
} catch (error) {
  console.error('❌ Ошибка при применении миграции:', error);
  process.exit(1);
} finally {
  await sql.end();
}

