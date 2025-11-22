#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверяю client_id в таблице bookings...\n');
    
    // Проверить последние брони
    const bookings = await sql`
      SELECT 
        b.id,
        b.start_at,
        b.end_at,
        b.car_id,
        b.client_id,
        b.created_at,
        er.external_id as rp_booking_id
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id 
        AND er.entity_type = 'booking' 
        AND er.system = 'rentprog'
      ORDER BY b.created_at DESC
      LIMIT 10
    `;
    
    console.log(`📋 Последние 10 броней:\n`);
    
    let withClient = 0;
    bookings.forEach((b, index) => {
      if (b.client_id) withClient++;
      
      console.log(`[${index + 1}] Booking ID: ${b.rp_booking_id || b.id.substring(0, 8)}`);
      console.log(`    Start: ${b.start_at}`);
      console.log(`    Car ID: ${b.car_id ? b.car_id.substring(0, 8) : 'N/A'}`);
      console.log(`    Client ID: ${b.client_id ? b.client_id.substring(0, 8) : 'N/A'}`);
      console.log('');
    });
    
    console.log(`✅ Брони с client_id: ${withClient} из ${bookings.length} (${((withClient / bookings.length) * 100).toFixed(1)}%)\n`);
    
    // Проверить external_refs для booking
    const bookingRefs = await sql`
      SELECT 
        er.entity_id,
        er.external_id as rp_booking_id,
        er.data
      FROM external_refs er
      WHERE er.entity_type = 'booking'
        AND er.system = 'rentprog'
      ORDER BY er.updated_at DESC
      LIMIT 5
    `;
    
    console.log('📋 External refs для последних 5 броней:\n');
    
    bookingRefs.forEach((ref, index) => {
      console.log(`[${index + 1}] RentProg ID: ${ref.rp_booking_id}`);
      console.log(`    Our UUID: ${ref.entity_id}`);
      
      if (ref.data) {
        const data = typeof ref.data === 'string' ? JSON.parse(ref.data) : ref.data;
        console.log(`    Client ID в data: ${data.client_id || 'N/A'}`);
        console.log(`    Car ID в data: ${data.car_id || 'N/A'}`);
      }
      console.log('');
    });
    
    // Общая статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(client_id) as with_client,
        COUNT(car_id) as with_car
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    
    const s = stats[0];
    console.log('═'.repeat(80));
    console.log('\n📊 Статистика за 7 дней:\n');
    console.log(`   Всего броней: ${s.total}`);
    console.log(`   С client_id: ${s.with_client} (${((s.with_client / s.total) * 100).toFixed(1)}%)`);
    console.log(`   С car_id: ${s.with_car} (${((s.with_car / s.total) * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

check();

