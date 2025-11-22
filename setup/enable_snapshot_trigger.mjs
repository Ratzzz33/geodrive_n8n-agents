import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function enableTrigger() {
  try {
    console.log('🔍 Проверка статуса триггера...\n');

    // Проверяем текущий статус
    const trigger = await sql`
      SELECT 
        tgname as trigger_name,
        tgenabled as enabled,
        tgrelid::regclass as table_name,
        CASE 
          WHEN tgenabled = 'O' THEN 'ENABLED'
          WHEN tgenabled = 'D' THEN 'DISABLED'
          WHEN tgenabled = 'R' THEN 'REPLICA'
          WHEN tgenabled = 'A' THEN 'ALWAYS'
          ELSE 'UNKNOWN'
        END as status
      FROM pg_trigger
      WHERE tgname = 'trg_sync_cars_from_snapshot'
    `;

    if (trigger.length === 0) {
      console.log('❌ Триггер не найден! Нужно применить миграцию.\n');
      return;
    }

    console.log('📊 Текущий статус триггера:');
    console.log(`   - Имя: ${trigger[0].trigger_name}`);
    console.log(`   - Таблица: ${trigger[0].table_name}`);
    console.log(`   - Статус: ${trigger[0].status}\n`);

    // Включаем триггер с режимом ALWAYS (всегда работает, даже если таблица отключена)
    console.log('🔧 Включаем триггер в режиме ALWAYS (всегда работает)...\n');
    await sql`
      ALTER TABLE rentprog_car_states_snapshot
      ENABLE ALWAYS TRIGGER trg_sync_cars_from_snapshot
    `;

    // Проверяем результат
    const updated = await sql`
      SELECT 
        tgname as trigger_name,
        CASE 
          WHEN tgenabled = 'O' THEN 'ENABLED'
          WHEN tgenabled = 'D' THEN 'DISABLED'
          WHEN tgenabled = 'R' THEN 'REPLICA'
          WHEN tgenabled = 'A' THEN 'ALWAYS'
          ELSE 'UNKNOWN'
        END as status
      FROM pg_trigger
      WHERE tgname = 'trg_sync_cars_from_snapshot'
    `;

    console.log('✅ Триггер включен в режиме ALWAYS:');
    console.log(`   - Статус: ${updated[0].status}\n`);

    console.log('🎉 Триггер всегда будет работать автоматически!\n');
    console.log('📋 Что происходит при сохранении snapshot:');
    console.log('   1. Данные сохраняются в rentprog_car_states_snapshot');
    console.log('   2. Триггер автоматически:');
    console.log('      - Раскладывает данные в таблицу cars');
    console.log('      - Создает запись в external_refs');
    console.log('      - Очищает поле data для визуального контроля');
    console.log('   3. Брони могут привязываться к машинам через rentprog_id\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

enableTrigger();

