#!/usr/bin/env node

import { createPostgresClient } from '../src/utils/db.mjs';

async function checkDataAfter25223() {
  const sql = await createPostgresClient();
  try {
    console.log('🔍 Проверка броней после execution 25223 (14:39 UTC)...\n');
    
    // Ищем брони обновленные после 14:39 UTC (18:39 грузинское время)
    const latestBookings = await sql`
      SELECT
        rentprog_id,
        client_name,
        car_name,
        total,
        updated_at,
        payload_json IS NOT NULL as has_payload,
        data,
        jsonb_typeof(data) as data_type,
        data->>'client_id' as data_client_id,
        data->>'car_id' as data_car_id,
        data->>'source' as data_source
      FROM bookings
      WHERE updated_at >= '2025-11-20 14:38:00'::timestamp
      ORDER BY updated_at DESC
      LIMIT 5;
    `;
    
    if (latestBookings.length === 0) {
      console.log('⚠️  Не найдено броней, обновленных после execution 25223');
      console.log('   Проверю последние 5 броней...\n');
      
      const anyBookings = await sql`
        SELECT
          rentprog_id,
          client_name,
          car_name,
          total,
          updated_at,
          payload_json IS NOT NULL as has_payload,
          data,
          jsonb_typeof(data) as data_type,
          data->>'client_id' as data_client_id,
          data->>'car_id' as data_car_id
        FROM bookings
        ORDER BY updated_at DESC
        LIMIT 5;
      `;
      latestBookings.push(...anyBookings);
    }
    
    console.log('📊 Последние брони:\n');
    latestBookings.forEach((b, i) => {
      console.log(`${i + 1}. Бронь ${b.rentprog_id}: ${b.client_name}`);
      console.log(`   Машина: ${b.car_name}`);
      console.log(`   Total: ${b.total}`);
      console.log(`   Обновлена: ${b.updated_at}`);
      console.log(`   payload_json: ${b.has_payload ? '✅ есть' : '❌ НЕТ'}`);
      console.log(`   data type: ${b.data_type || 'NULL'}`);
      
      const dataKeys = b.data ? Object.keys(b.data).length : 0;
      if (dataKeys > 0) {
        console.log(`   data: ✅ ${dataKeys} ключей`);
        console.log(`     client_id: ${b.data_client_id}`);
        console.log(`     car_id: ${b.data_car_id}`);
        console.log(`     source: ${b.data_source}`);
      } else {
        console.log(`   data: ❌ ПУСТО (0 ключей)`);
      }
      console.log('');
    });
    
    // Статистика
    const stats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(payload_json) as with_payload,
        COUNT(CASE WHEN jsonb_typeof(data) = 'object' AND jsonb_object_keys(data) IS NOT NULL THEN 1 END) as with_data,
        COUNT(CASE WHEN updated_at >= '2025-11-20 14:38:00'::timestamp THEN 1 END) as updated_after_execution
      FROM bookings;
    `;
    
    const s = stats[0];
    console.log('📈 Общая статистика:');
    console.log(`   Всего броней: ${s.total}`);
    console.log(`   С payload_json: ${s.with_payload} (${((s.with_payload / s.total) * 100).toFixed(1)}%)`);
    console.log(`   С data (JSONB): ${s.with_data} (${((s.with_data / s.total) * 100).toFixed(1)}%)`);
    console.log(`   Обновлено после execution: ${s.updated_after_execution}`);
    
    if (s.with_data > 0) {
      console.log('\n🎉 SUCCESS! Поле data заполняется!');
    } else {
      console.log('\n❌ FAIL! Поле data все еще пусто');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
  }
}

checkDataAfter25223();

