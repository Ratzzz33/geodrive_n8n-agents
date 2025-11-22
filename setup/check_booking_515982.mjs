#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBooking() {
  try {
    const rentprogId = 515982;
    console.log(`🔍 Проверка брони RentProg ID: ${rentprogId}\n`);
    console.log('='.repeat(80));

    // 1. Поиск брони
    const booking = await sql`
      SELECT 
        b.id,
        b.in_rent,
        b.status,
        b.state,
        b.start_at,
        b.end_at,
        b.start_date,
        b.end_date,
        b.created_at,
        b.updated_at,
        er.external_id
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id 
        AND er.entity_type = 'booking' 
        AND er.system = 'rentprog'
      WHERE er.external_id = ${rentprogId.toString()}
    `;

    if (booking.length === 0) {
      console.log('❌ Бронь не найдена в БД');
      return;
    }

    const b = booking[0];
    console.log('📋 Данные из БД:');
    console.log(`   RentProg ID: ${b.external_id}`);
    console.log(`   Status: ${b.status}`);
    console.log(`   State: ${b.state}`);
    console.log(`   In Rent: ${b.in_rent}`);
    console.log('-'.repeat(40));
    
    // Форматируем даты
    const formatDate = (date) => {
      if (!date) return 'null';
      return date.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' }) + 
             ` (${date.toISOString()})`;
    };

    console.log(`   start_at (timestamptz):   ${formatDate(b.start_at)}`);
    console.log(`   end_at (timestamptz):     ${formatDate(b.end_at)}`);
    console.log(`   updated_at (timestamptz): ${formatDate(b.updated_at)}`);
    console.log('-'.repeat(40));
    console.log(`   start_date (text):        ${b.start_date}`);
    console.log(`   end_date (text):          ${b.end_date}`);

    // Проверка формата start_date/end_date
    if (b.start_date && b.start_date.includes('+04')) {
      console.log('\n✅ start_date имеет правильный формат (+04)');
    } else if (b.start_date) {
      console.log('\n⚠️ start_date имеет НЕПРАВИЛЬНЫЙ формат (не +04)');
    }

    if (b.end_date && b.end_date.includes('+04')) {
      console.log('✅ end_date имеет правильный формат (+04)');
    } else if (b.end_date) {
      console.log('⚠️ end_date имеет НЕПРАВИЛЬНЫЙ формат (не +04)');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkBooking();

