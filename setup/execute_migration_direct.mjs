import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔧 Выполнение миграции 0015 на сервере...\n');
  
  // 1. Удаление дубликатов
  console.log('1. Удаление дубликатов starline_device_id...');
  const deleteResult = await sql`
    DELETE FROM gps_tracking gt1
    WHERE gt1.id NOT IN (
      SELECT DISTINCT ON (starline_device_id) id
      FROM gps_tracking
      WHERE starline_device_id IS NOT NULL
      ORDER BY starline_device_id, last_sync DESC NULLS LAST, id DESC
    )
  `;
  console.log(`   ✅ Удалено дубликатов: ${deleteResult.count || 0}`);
  
  // 2. Удаление UNIQUE constraint на car_id
  console.log('\n2. Удаление UNIQUE constraint на car_id...');
  await sql`
    DO $$ 
    BEGIN 
      IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'gps_tracking_car_id_key'
      ) THEN
        ALTER TABLE gps_tracking DROP CONSTRAINT gps_tracking_car_id_key;
        RAISE NOTICE 'Удален UNIQUE constraint на car_id';
      END IF;
    END $$;
  `;
  console.log('   ✅ Проверка выполнена');
  
  // 3. Создание уникального индекса
  console.log('\n3. Создание уникального индекса на starline_device_id...');
  try {
    await sql`
      CREATE UNIQUE INDEX gps_tracking_starline_device_id_unique 
      ON gps_tracking(starline_device_id) 
      WHERE starline_device_id IS NOT NULL
    `;
    console.log('   ✅ Индекс создан');
  } catch (e) {
    if (e.code === '42P07') {
      console.log('   ℹ️ Индекс уже существует');
    } else {
      throw e;
    }
  }
  
  // 4. Исправление неправильных записей
  console.log('\n4. Исправление неправильных записей...');
  const updateResult = await sql`
    UPDATE gps_tracking gt
    SET car_id = sd.car_id
    FROM starline_devices sd
    WHERE gt.starline_device_id = sd.device_id
      AND sd.matched = TRUE
      AND sd.active = TRUE
      AND gt.car_id != sd.car_id
  `;
  console.log(`   ✅ Обновлено записей: ${updateResult.count || 0}`);
  
  console.log('\n✅ Миграция выполнена успешно!');
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  if (error.detail) {
    console.error('   Детали:', error.detail);
  }
  process.exit(1);
} finally {
  await sql.end();
}

