#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

try {
  console.log('🔍 Проверяю бронь rentprog_id=509606 в БД...\n');
  
  // Проверяем в bookings
  const booking = await sql`
    SELECT 
      id,
      rentprog_id,
      number,
      branch,
      car_code,
      client_name,
      start_date,
      end_date,
      state,
      total,
      rental_cost,
      created_at,
      updated_at
    FROM bookings
    WHERE rentprog_id = '509606'
    LIMIT 1
  `;
  
  if (booking.length > 0) {
    console.log('✅ Бронь найдена в таблице bookings:');
    console.log(JSON.stringify(booking[0], null, 2));
    
    // Проверяем external_refs
    const extRef = await sql`
      SELECT 
        id,
        entity_type,
        entity_id,
        system,
        external_id,
        branch_code,
        created_at
      FROM external_refs
      WHERE system = 'rentprog' 
        AND external_id = '509606'
      LIMIT 1
    `;
    
    if (extRef.length > 0) {
      console.log('\n✅ Запись найдена в external_refs:');
      console.log(JSON.stringify(extRef[0], null, 2));
    } else {
      console.log('\n⚠️  Запись НЕ найдена в external_refs');
    }
    
  } else {
    console.log('❌ Бронь НЕ найдена в таблице bookings');
    
    // Проверяем по number и branch
    const byNumber = await sql`
      SELECT 
        id,
        rentprog_id,
        number,
        branch,
        car_code
      FROM bookings
      WHERE number = 3976 AND branch = 'tbilisi'
      LIMIT 1
    `;
    
    if (byNumber.length > 0) {
      console.log('\n⚠️  Найдена бронь с number=3976, но rentprog_id отличается:');
      console.log(JSON.stringify(byNumber[0], null, 2));
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
} finally {
  await sql.end();
}

