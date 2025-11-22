#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  console.log('🔍 Проверка последних броней...\n');
  
  const latestBookings = await sql`
    SELECT
      rentprog_id,
      client_name,
      car_name,
      total,
      updated_at,
      data,
      data->>'client_id' as data_client_id,
      data->>'car_id' as data_car_id
    FROM bookings
    ORDER BY updated_at DESC
    LIMIT 3;
  `;
  
  console.log('📊 Последние 3 брони:\n');
  latestBookings.forEach((b, i) => {
    console.log(`${i + 1}. Бронь ${b.rentprog_id}: ${b.client_name}`);
    console.log(`   Машина: ${b.car_name}`);
    console.log(`   Total: ${b.total}`);
    console.log(`   Обновлена: ${b.updated_at}`);
    
    const dataKeys = b.data ? Object.keys(b.data).length : 0;
    if (dataKeys > 0) {
      console.log(`   data: ✅ ${dataKeys} ключей`);
      console.log(`     client_id: ${b.data_client_id}`);
      console.log(`     car_id: ${b.data_car_id}`);
    } else {
      console.log(`   data: ❌ ПУСТО (0 ключей)`);
    }
    console.log('');
  });
  
  // Статистика за последний час
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN jsonb_typeof(data) = 'object' THEN 1 END) as with_data_object,
      COUNT(CASE WHEN data IS NOT NULL AND data::text != '{}' THEN 1 END) as with_data_filled
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 hour';
  `;
  
  const s = stats[0];
  console.log('📈 Статистика за последний час:');
  console.log(`   Обновлено броней: ${s.total}`);
  console.log(`   С data (object): ${s.with_data_object} (${s.total > 0 ? ((s.with_data_object / s.total) * 100).toFixed(1) : 0}%)`);
  console.log(`   С data (заполнено): ${s.with_data_filled} (${s.total > 0 ? ((s.with_data_filled / s.total) * 100).toFixed(1) : 0}%)`);
  
  if (s.with_data_filled > 0) {
    console.log('\n🎉 SUCCESS! Поле data заполняется!');
  } else {
    console.log('\n❌ FAIL! Поле data все еще пусто');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

