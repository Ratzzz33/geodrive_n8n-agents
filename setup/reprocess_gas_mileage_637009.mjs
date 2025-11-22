#!/usr/bin/env node

/**
 * Reprocess history record 637009 to apply gas_mileage change with fixed parser
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function reprocess() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔄 Переобработка записи 637009 с исправленным парсером...\n');

    // Reset processed flag - this will trigger auto_process_history_trigger
    await sql`
      UPDATE history
      SET processed = FALSE, notes = NULL, error_code = NULL
      WHERE id = 637009
    `;

    console.log('✅ Сброс выполнен. Ждём 2 секунды для срабатывания триггера...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check the record after processing
    const history = await sql`
      SELECT id, processed, notes, entity_type, entity_id, error_code
      FROM history
      WHERE id = 637009
    `;

    console.log('📜 Запись history после триггера:');
    console.log(`  ID: ${history[0].id}`);
    console.log(`  Entity Type: ${history[0].entity_type}`);
    console.log(`  Entity ID: ${history[0].entity_id}`);
    console.log(`  Обработано: ${history[0].processed ? '✅ ДА' : '❌ НЕТ'}`);
    console.log(`  Код ошибки: ${history[0].error_code || 'NULL (успешно)'}`);
    console.log(`  Заметки: ${history[0].notes || 'NULL'}`);

    // Check gas_mileage in cars table
    console.log('\n🚗 Проверяем gas_mileage в таблице cars...');
    
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
    
    const car = await sql`
      SELECT 
        rentprog_id,
        data->>'gas_mileage' as gas_mileage,
        data->>'tank_value' as tank_value,
        data->>'car_class' as car_class,
        updated_at
      FROM cars
      WHERE id = ${carUuid}
    `;

    if (car.length === 0) {
      console.log('❌ Авто не найдено в таблице cars');
      return;
    }

    console.log(`\n  RentProg ID: ${car[0].rentprog_id}`);
    console.log(`  gas_mileage: ${car[0].gas_mileage}`);
    console.log(`  tank_value: ${car[0].tank_value}`);
    console.log(`  car_class: ${car[0].car_class}`);
    console.log(`  Последнее обновление: ${car[0].updated_at}`);

    if (car[0].gas_mileage === '7.4') {
      console.log('\n✅ SUCCESS! gas_mileage успешно изменён с 7.3 на 7.4');
    } else if (car[0].gas_mileage === '7' || car[0].gas_mileage === '7.3') {
      console.log(`\n❌ FAILED! gas_mileage = "${car[0].gas_mileage}" (должен быть "7.4")`);
      console.log('   Проверьте error_code и notes в history record для деталей.');
    } else {
      console.log(`\n⚠️ UNEXPECTED! gas_mileage = "${car[0].gas_mileage}" (ожидалось "7.4")`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

reprocess().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

