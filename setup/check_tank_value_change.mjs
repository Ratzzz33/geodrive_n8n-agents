#!/usr/bin/env node

/**
 * Check if tank_value change event was processed for car 39736
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkTankValueChange() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
    idle_timeout: 5
  });

  try {
    console.log('🔍 Проверка обработки события изменения tank_value для авто 39736...\n');

    // 1. Найти запись в history
    console.log('📜 Ищем запись в таблице history...');
    const historyRecords = await sql`
      SELECT 
        id,
        ts,
        created_at,
        branch,
        operation_type,
        description,
        entity_type,
        entity_id,
        processed,
        notes,
        raw_data
      FROM history
      WHERE description ILIKE '%tank_value%'
        AND description ILIKE '%39736%'
        AND description ILIKE '%47%'
        AND description ILIKE '%46%'
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (historyRecords.length === 0) {
      console.log('❌ Запись в history не найдена!');
      console.log('   Возможно, workflow ещё не успел спарсить это событие.');
      return;
    }

    console.log(`✅ Найдено записей: ${historyRecords.length}\n`);

    for (const record of historyRecords) {
      console.log('─'.repeat(60));
      console.log(`ID: ${record.id}`);
      console.log(`Время: ${record.ts || record.created_at}`);
      console.log(`Филиал: ${record.branch}`);
      console.log(`Тип операции: ${record.operation_type}`);
      console.log(`Entity Type: ${record.entity_type || 'NULL'}`);
      console.log(`Entity ID: ${record.entity_id || 'NULL'}`);
      console.log(`Обработано: ${record.processed ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`Описание:`);
      console.log(`  ${record.description}`);
      if (record.notes) {
        console.log(`\nЗаметки: ${record.notes}`);
      }
      if (record.raw_data && typeof record.raw_data === 'object') {
        console.log(`\nRaw Data:`);
        console.log(JSON.stringify(record.raw_data, null, 2));
      }
      console.log('');
    }

    // 2. Проверить значение tank_value в таблице cars
    console.log('─'.repeat(60));
    console.log('🚗 Проверяем значение tank_value в таблице cars...\n');

    const externalRef = await sql`
      SELECT entity_id
      FROM external_refs
      WHERE system = 'rentprog'
        AND entity_type = 'car'
        AND external_id = '39736'
      LIMIT 1
    `;

    if (externalRef.length === 0) {
      console.log('❌ Авто 39736 не найдено в external_refs');
      return;
    }

    const carUuid = externalRef[0].entity_id;
    console.log(`Внутренний UUID авто: ${carUuid}\n`);

    const car = await sql`
      SELECT 
        id,
        rentprog_id,
        data->>'tank_value' as tank_value,
        data->>'car_class' as car_class,
        data,
        updated_at
      FROM cars
      WHERE id = ${carUuid}
    `;

    if (car.length === 0) {
      console.log('❌ Авто не найдено в таблице cars');
      return;
    }

    const carData = car[0];
    console.log('Данные авто:');
    console.log(`  RentProg ID: ${carData.rentprog_id}`);
    console.log(`  tank_value: ${carData.tank_value || 'NULL'}`);
    console.log(`  car_class: ${carData.car_class || 'NULL'}`);
    console.log(`  Последнее обновление: ${carData.updated_at}`);

    // Проверка результата
    console.log('\n' + '─'.repeat(60));
    if (carData.tank_value === '46') {
      console.log('✅ SUCCESS! tank_value успешно изменён на 46');
    } else if (carData.tank_value === '47') {
      console.log('❌ FAILED! tank_value всё ещё 47 (должен быть 46)');
      console.log('   Проверьте notes в history record для деталей.');
    } else {
      console.log(`⚠️ UNEXPECTED! tank_value = "${carData.tank_value}" (ожидалось "46")`);
    }

    // Показать полный data если нужно
    if (carData.data && typeof carData.data === 'object') {
      const fullData = carData.data;
      if (fullData.tank_value) {
        console.log(`\nПолное значение из data.tank_value: ${fullData.tank_value}`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkTankValueChange().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

