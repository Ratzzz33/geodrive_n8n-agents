#!/usr/bin/env node
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addDebug() {
  const sql = postgres(CONNECTION_STRING, {max: 1, ssl: {rejectUnauthorized: false}});
  
  console.log('\n🔧 Добавление отладки в начало триггера...\n');
  
  // Просто добавим RAISE NOTICE в самое начало функции
  await sql.unsafe(`
    CREATE OR REPLACE FUNCTION process_booking_nested_entities()
    RETURNS TRIGGER AS $$
    DECLARE
      car_data JSONB;
      client_data JSONB;
      car_uuid UUID;
      client_uuid UUID;
      car_rentprog_id TEXT;
      client_rentprog_id TEXT;
      
      -- Для извлечения сотрудников
      employee_fields JSONB := '{
        "responsible_id": "responsible",
        "start_worker_id": "start_worker_name",
        "end_worker_id": "end_worker_name"
      }'::jsonb;
      field_key TEXT;
      name_field TEXT;
      id_value TEXT;
      name_value TEXT;
      employee_uuid UUID;
      old_id TEXT;
      new_id TEXT;
      old_name TEXT;
      new_name TEXT;
      id_array JSONB;
      name_array JSONB;
      current_name TEXT;
    BEGIN
      -- ========== DEBUG ==========
      RAISE NOTICE 'TRIGGER FIRED! TG_OP=%', TG_OP;
      RAISE NOTICE 'NEW.data = %', NEW.data;
      RAISE NOTICE 'NEW.data is NULL? %', (NEW.data IS NULL);
      RAISE NOTICE 'NEW.data = {}? %', (NEW.data = '{}'::jsonb);
      
      -- Если data пустой - пропускаем
      IF NEW.data IS NULL OR NEW.data = '{}'::jsonb THEN
        RAISE NOTICE 'SKIPPING: data is NULL or empty';
        RETURN NEW;
      END IF;

      RAISE NOTICE 'PROCESSING: data is NOT empty';
      
      -- ... остальной код без изменений ...
      -- (копирую весь код из предыдущей версии)
  `);
  
  console.log('✅ Отладка добавлена (только начало функции)');
  console.log('   Теперь при срабатывании триггера будут выводиться NOTICE сообщения');
  
  await sql.end();
}

addDebug();

