#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверка поля data в последних бронях...\n');
  
  const bookings = await sql`
    SELECT 
      rentprog_id,
      client_name,
      data
    FROM bookings
    WHERE updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC
    LIMIT 3
  `;
  
  bookings.forEach((b, idx) => {
    console.log(`${idx + 1}. Бронь ${b.rentprog_id}: ${b.client_name}`);
    console.log(`   data->client_id: ${b.data?.client_id || 'НЕТ'}`);
    console.log(`   Ключи в data (первые 10):`);
    
    const keys = Object.keys(b.data || {}).slice(0, 10);
    keys.forEach(key => {
      const value = b.data[key];
      const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : value;
      console.log(`     - ${key}: ${displayValue}`);
    });
    console.log('');
  });
  
  console.log('✅ Проверка завершена');
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
