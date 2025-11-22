#!/usr/bin/env node

/**
 * Проверка брони 513948 (Cruze 551 Hatch) в базе данных
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBooking() {
  console.log('🔍 Проверка брони 513948 в базе данных...\n');

  try {
    // Проверяем по rentprog_id
    const booking = await sql`
      SELECT 
        id,
        rentprog_id,
        branch,
        number,
        car_code,
        car_name,
        start_date,
        end_date,
        start_at,
        end_at,
        state,
        created_at,
        updated_at
      FROM bookings
      WHERE rentprog_id = '513948'
    `;

    if (booking.length > 0) {
      console.log('✅ Бронь НАЙДЕНА в базе данных!\n');
      const b = booking[0];
      console.log('📋 Детали:');
      console.log(`   ID (UUID): ${b.id}`);
      console.log(`   rentprog_id: ${b.rentprog_id}`);
      console.log(`   number: ${b.number}`);
      console.log(`   branch: ${b.branch}`);
      console.log(`   car_code: ${b.car_code}`);
      console.log(`   car_name: ${b.car_name}`);
      console.log(`   start_date: ${b.start_date}`);
      console.log(`   end_date: ${b.end_date}`);
      console.log(`   start_at: ${b.start_at}`);
      console.log(`   end_at: ${b.end_at}`);
      console.log(`   state: ${b.state}`);
      console.log(`   created_at: ${b.created_at}`);
      console.log(`   updated_at: ${b.updated_at}`);
    } else {
      console.log('❌ Бронь НЕ НАЙДЕНА в базе данных\n');
      
      // Проверяем есть ли вообще какие-то брони Cruze 551
      console.log('🔍 Поиск других броней Cruze 551 Hatch...');
      const otherCruze = await sql`
        SELECT rentprog_id, number, car_code, start_date, end_date, state
        FROM bookings
        WHERE car_code ILIKE '%Cruze 551%'
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      if (otherCruze.length > 0) {
        console.log(`\n📋 Найдено ${otherCruze.length} других броней Cruze 551:`);
        otherCruze.forEach((b, i) => {
          console.log(`   ${i + 1}. rentprog_id: ${b.rentprog_id}, number: ${b.number}, dates: ${b.start_date} - ${b.end_date}, state: ${b.state}`);
        });
      } else {
        console.log('   Других броней Cruze 551 не найдено');
      }
    }

    // Общая статистика
    console.log('\n📊 Общая статистика броней:');
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN rentprog_id IS NOT NULL THEN 1 END) as with_rentprog_id,
        COUNT(CASE WHEN state = 'Новая' THEN 1 END) as new_state,
        COUNT(CASE WHEN state = 'Активная' THEN 1 END) as active_state
      FROM bookings
    `;
    
    console.log(`   Всего броней: ${stats[0].total}`);
    console.log(`   С rentprog_id: ${stats[0].with_rentprog_id}`);
    console.log(`   Статус "Новая": ${stats[0].new_state}`);
    console.log(`   Статус "Активная": ${stats[0].active_state}`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

checkBooking().catch(console.error);

