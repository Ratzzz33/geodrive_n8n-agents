/**
 * Получение брони с полным payload из external_refs
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function getBookingWithPayload() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📋 Получение брони 509620 с полным payload\n');

    const result = await sql`
      SELECT 
        b.id as booking_uuid,
        b.state,
        b.start_at,
        b.end_at,
        b.car_id,
        b.client_id,
        er.external_id as rentprog_id,
        er.data as payload_json,
        er.data->'payload_json' as payload_content,
        er.data->'payload_json'->'car' as car_data,
        er.data->'payload_json'->'client' as client_data,
        er.data->'payload_json'->'booking' as booking_data
      FROM bookings b
      JOIN external_refs er ON er.entity_id = b.id
      WHERE er.entity_type = 'booking'
        AND er.system = 'rentprog'
        AND er.external_id = '509620'
    `;

    if (result.length > 0) {
      const booking = result[0];
      
      console.log('✅ Бронь найдена!');
      console.log('');
      console.log('📦 Основные данные:');
      console.log('   UUID:', booking.booking_uuid);
      console.log('   RentProg ID:', booking.rentprog_id);
      console.log('   Статус:', booking.state || 'N/A');
      console.log('   Начало:', booking.start_at || 'N/A');
      console.log('   Окончание:', booking.end_at || 'N/A');
      console.log('');
      
      if (booking.payload_content) {
        console.log('📄 Payload содержит:');
        console.log('   Ключи:', Object.keys(booking.payload_content));
        console.log('');
        
        if (booking.car_data) {
          console.log('🚗 Данные машины:');
          console.log('   ID:', booking.car_data.id);
          console.log('   Модель:', booking.car_data.model);
          console.log('   Номер:', booking.car_data.plate);
          console.log('');
        }
        
        if (booking.client_data) {
          console.log('👤 Данные клиента:');
          console.log('   ID:', booking.client_data.id);
          console.log('   Имя:', booking.client_data.name);
          console.log('   Телефон:', booking.client_data.phone);
          console.log('');
        }
        
        if (booking.booking_data) {
          console.log('📅 Данные брони:');
          console.log('   ID:', booking.booking_data.id);
          console.log('   Цена:', booking.booking_data.price);
          console.log('   Депозит:', booking.booking_data.deposit);
          console.log('   Начало:', booking.booking_data.start_date);
          console.log('   Окончание:', booking.booking_data.end_date);
          console.log('');
        }
      } else {
        console.log('⚠️  Payload пуст или не содержит вложенных данных');
        console.log('   Полный payload:', JSON.stringify(booking.payload_json, null, 2));
      }
      
    } else {
      console.log('❌ Бронь 509620 не найдена');
      console.log('');
      console.log('💡 Проверим последние 5 броней:');
      
      const recent = await sql`
        SELECT 
          b.id as booking_uuid,
          er.external_id as rentprog_id,
          b.state,
          b.created_at,
          jsonb_typeof(er.data) as data_type,
          pg_column_size(er.data) as data_size
        FROM bookings b
        JOIN external_refs er ON er.entity_id = b.id
        WHERE er.entity_type = 'booking'
          AND er.system = 'rentprog'
        ORDER BY b.created_at DESC
        LIMIT 5
      `;
      
      recent.forEach((booking, idx) => {
        console.log(`   ${idx + 1}. RentProg ID: ${booking.rentprog_id}`);
        console.log(`      UUID: ${booking.booking_uuid}`);
        console.log(`      Статус: ${booking.state || 'N/A'}`);
        console.log(`      Data type: ${booking.data_type}`);
        console.log(`      Data size: ${booking.data_size} bytes`);
        console.log('');
      });
    }

  } finally {
    await sql.end();
  }
}

getBookingWithPayload().catch(console.error);

