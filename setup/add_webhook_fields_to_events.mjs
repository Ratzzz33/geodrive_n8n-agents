import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('\n📋 Добавление полей для вебхуков в таблицу events...\n');

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  // 1. Добавляем поле для полного JSON payload
  console.log('1️⃣ Добавление поля payload (JSONB)...');
  
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS payload JSONB;
  `);
  
  console.log('   ✅ Поле payload добавлено\n');
  
  // 2. Добавляем поле для операции
  console.log('2️⃣ Добавление поля operation...');
  
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS operation TEXT;
  `);
  
  console.log('   ✅ Поле operation добавлено\n');
  
  // 3. Добавляем поле для типа сущности
  console.log('3️⃣ Добавление поля entity_type...');
  
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS entity_type TEXT;
  `);
  
  console.log('   ✅ Поле entity_type добавлено\n');
  
  // 4. Добавляем поле для исходного события (raw event name)
  console.log('4️⃣ Добавление поля event_name...');
  
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS event_name TEXT;
  `);
  
  console.log('   ✅ Поле event_name добавлено\n');
  
  // 5. Добавляем метаданные (для дополнительной информации)
  console.log('5️⃣ Добавление поля metadata (JSONB)...');
  
  await sql.unsafe(`
    ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS metadata JSONB;
  `);
  
  console.log('   ✅ Поле metadata добавлено\n');
  
  // 6. Создаём индексы
  console.log('6️⃣ Создание индексов...');
  
  // GIN индекс для JSONB поиска
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_payload_gin 
    ON events USING gin(payload);
  `);
  
  console.log('   ✅ idx_events_payload_gin');
  
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_metadata_gin 
    ON events USING gin(metadata);
  `);
  
  console.log('   ✅ idx_events_metadata_gin');
  
  // Обычные индексы
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_operation 
    ON events(operation);
  `);
  
  console.log('   ✅ idx_events_operation');
  
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_entity_type 
    ON events(entity_type);
  `);
  
  console.log('   ✅ idx_events_entity_type');
  
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_events_event_name 
    ON events(event_name);
  `);
  
  console.log('   ✅ idx_events_event_name\n');
  
  // 7. Проверяем результат
  console.log('7️⃣ Проверка новой структуры...\n');
  
  const columns = await sql.unsafe(`
    SELECT 
      column_name, 
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position;
  `);
  
  console.log('📊 Полная структура таблицы events:');
  console.log('═════════════════════════════════════════════════════════════════');
  columns.forEach((col, i) => {
    const marker = ['payload', 'operation', 'entity_type', 'event_name', 'metadata'].includes(col.column_name) ? '🆕' : '  ';
    console.log(`${marker} ${i + 1}. ${col.column_name.padEnd(20)} ${col.data_type.padEnd(25)} ${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'}`);
  });
  console.log('═════════════════════════════════════════════════════════════════\n');
  
  console.log('✅ Миграция завершена успешно!\n');
  
  console.log('📝 Описание новых полей:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('   payload (JSONB)      - Полное JSON тело вебхука от RentProg');
  console.log('   operation (TEXT)     - Операция: create | update | destroy');
  console.log('   entity_type (TEXT)   - Тип сущности: car | client | booking');
  console.log('   event_name (TEXT)    - Исходное название события (car_update, booking_create)');
  console.log('   metadata (JSONB)     - Дополнительные метаданные (branch, user_id, и т.д.)');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  console.log('💡 Пример использования:');
  console.log(`
  INSERT INTO events (
    type, 
    rentprog_id, 
    company_id,
    event_name,
    entity_type,
    operation,
    payload,
    metadata
  ) VALUES (
    'car_update',
    '38204',
    9247,
    'car_update',
    'car',
    'update',
    '{"id": 38204, "mileage": [100, 200], "company_id": 9247}'::jsonb,
    '{"source": "webhook", "timestamp": "2025-11-04T05:00:00Z"}'::jsonb
  );
  `);
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

