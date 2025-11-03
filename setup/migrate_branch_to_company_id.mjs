import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔄 Миграция: branch → company_id в таблице events');
console.log('');

try {
  // 1. Добавить колонку company_id
  console.log('1. Добавление колонки company_id...');
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS company_id INTEGER
  `);
  console.log('   ✅ Колонка company_id добавлена');
  
  // 2. Создать индекс на company_id
  console.log('2. Создание индекса на company_id...');
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_company_id 
    ON events(company_id)
  `);
  console.log('   ✅ Индекс создан');
  
  // 3. Удалить старый unique constraint с branch
  console.log('3. Удаление старого unique constraint...');
  await sql.unsafe(`
    ALTER TABLE events 
    DROP CONSTRAINT IF EXISTS events_branch_type_rentprog_id_unique
  `);
  console.log('   ✅ Старый constraint удален');
  
  // 4. Создать новый unique constraint с company_id
  console.log('4. Создание нового unique constraint...');
  await sql.unsafe(`
    ALTER TABLE events 
    ADD CONSTRAINT events_company_id_type_rentprog_id_unique 
    UNIQUE (company_id, type, rentprog_id)
  `);
  console.log('   ✅ Новый constraint создан');
  
  // 5. Удалить колонку branch (опционально)
  console.log('5. Удаление колонки branch...');
  await sql.unsafe(`
    ALTER TABLE events 
    DROP COLUMN IF EXISTS branch
  `);
  console.log('   ✅ Колонка branch удалена');
  
  console.log('');
  console.log('✅ Миграция завершена успешно!');
  console.log('');
  console.log('📝 Изменения:');
  console.log('   - branch (TEXT) → company_id (INTEGER)');
  console.log('   - Новый unique constraint: (company_id, type, rentprog_id)');
  console.log('   - Индекс на company_id для быстрого поиска');
  
} catch (error) {
  console.error('❌ Ошибка миграции:', error);
  throw error;
} finally {
  await sql.end();
}

