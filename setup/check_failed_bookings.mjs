/**
 * Проверка проблемных бронирований из Tbilisi
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const failedBookingIds = [450490, 280489, 194178, 167505];

async function checkBookings() {
  console.log('Проверка проблемных бронирований из Tbilisi\n');
  console.log('='.repeat(70));
  
  for (const bookingId of failedBookingIds) {
    console.log(`\n📋 Бронирование #${bookingId}:`);
    
    // Проверяем, есть ли оно в external_refs
    const refs = await sql`
      SELECT * FROM external_refs 
      WHERE system = 'rentprog' 
        AND external_id = ${String(bookingId)}
        AND entity_type = 'booking'
    `;
    
    if (refs.length > 0) {
      console.log(`   ✅ Найдено в external_refs: entity_id = ${refs[0].entity_id}`);
      
      // Проверяем само бронирование
      const booking = await sql`
        SELECT * FROM bookings WHERE id = ${refs[0].entity_id}
      `;
      
      if (booking.length > 0) {
        console.log(`   ✅ Бронирование существует в БД`);
        console.log(`      client_id: ${booking[0].client_id || 'NULL'}`);
        console.log(`      car_id: ${booking[0].car_id || 'NULL'}`);
        
        // Проверяем клиента
        if (booking[0].client_id) {
          const client = await sql`
            SELECT * FROM clients WHERE id = ${booking[0].client_id}
          `;
          if (client.length > 0) {
            console.log(`   ✅ Клиент существует`);
          } else {
            console.log(`   ❌ Клиент НЕ существует (проблема FK constraint)`);
          }
        }
      } else {
        console.log(`   ❌ Бронирование НЕ существует в БД`);
      }
    } else {
      console.log(`   ❌ НЕ найдено в external_refs (не было синхронизировано)`);
    }
  }
  
  await sql.end();
}

checkBookings().catch(console.error);

