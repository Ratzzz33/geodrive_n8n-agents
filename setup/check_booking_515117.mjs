#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBooking() {
  try {
    const rentprogId = '515117';
    
    console.log('🔍 Проверка брони RentProg ID: 515117\n');
    console.log('='.repeat(80));
    
    // 1. Найти бронь по RentProg ID
    console.log('\n📋 1. Поиск брони в БД:');
    console.log('-'.repeat(80));
    
    const bookings = await sql`
      SELECT 
        b.id,
        b.status,
        b.state,
        b.in_rent,
        b.archive,
        b.start_at,
        b.end_at,
        b.start_date,
        b.end_date,
        b.updated_at,
        b.updated_by_source,
        b.updated_by_user,
        b.updated_by_workflow,
        b.data,
        er.external_id as rentprog_id
      FROM bookings b
      LEFT JOIN external_refs er ON er.entity_id = b.id 
        AND er.entity_type = 'booking' 
        AND er.system = 'rentprog'
      WHERE er.external_id = ${rentprogId}
      ORDER BY b.updated_at DESC
      LIMIT 1
    `;
    
    if (bookings.length === 0) {
      console.log('❌ Бронь с RentProg ID 515117 НЕ НАЙДЕНА в БД');
      
      // Попробуем найти по data->>'id' или data->>'rentprog_id'
      console.log('\n🔍 Поиск по data->>id и data->>rentprog_id...');
      const bookingsByData = await sql`
        SELECT 
          b.id,
          b.status,
          b.state,
          b.in_rent,
          b.archive,
          b.updated_at,
          b.data->>'id' as data_id,
          b.data->>'rentprog_id' as data_rentprog_id
        FROM bookings b
        WHERE b.data->>'id' = ${rentprogId}
           OR b.data->>'rentprog_id' = ${rentprogId}
        ORDER BY b.updated_at DESC
        LIMIT 5
      `;
      
      if (bookingsByData.length > 0) {
        console.log(`✅ Найдено ${bookingsByData.length} броней по data:\n`);
        bookingsByData.forEach((b, idx) => {
          console.log(`${idx + 1}. ID: ${b.id}`);
          console.log(`   in_rent: ${b.in_rent}`);
          console.log(`   status: ${b.status}`);
          console.log(`   state: ${b.state}`);
          console.log(`   updated_at: ${b.updated_at}`);
          console.log(`   data->>id: ${b.data_id}`);
          console.log(`   data->>rentprog_id: ${b.data_rentprog_id}`);
          console.log('');
        });
      } else {
        console.log('❌ Бронь не найдена ни по external_refs, ни по data');
      }
      
      return;
    }
    
    const booking = bookings[0];
    console.log('✅ Бронь найдена:');
    console.log(`   UUID: ${booking.id}`);
    console.log(`   RentProg ID: ${booking.rentprog_id}`);
    console.log(`   in_rent: ${booking.in_rent}`);
    console.log(`   status: ${booking.status || 'N/A'}`);
    console.log(`   state: ${booking.state || 'N/A'}`);
    console.log(`   archive: ${booking.archive || 'N/A'}`);
    console.log(`   start_at: ${booking.start_at || 'N/A'}`);
    console.log(`   end_at: ${booking.end_at || 'N/A'}`);
    console.log(`   start_date: ${booking.start_date || 'N/A'}`);
    console.log(`   end_date: ${booking.end_date || 'N/A'}`);
    console.log(`   updated_at: ${booking.updated_at}`);
    console.log(`   updated_by_source: ${booking.updated_by_source || 'не указан'}`);
    console.log(`   updated_by_user: ${booking.updated_by_user || 'не указан'}`);
    console.log(`   updated_by_workflow: ${booking.updated_by_workflow || 'не указан'}`);
    
    // Проверка соответствия ожидаемому значению
    console.log('\n📊 2. Проверка статуса:');
    console.log('-'.repeat(80));
    
    if (booking.in_rent === true) {
      console.log('✅ in_rent = true (соответствует ожидаемому значению)');
    } else if (booking.in_rent === false) {
      console.log('❌ in_rent = false (НЕ соответствует ожидаемому значению true)');
    } else {
      console.log('⚠️  in_rent = null (не установлено)');
    }
    
    // Проверка времени обновления
    const expectedUpdateTime = new Date('2025-11-21T19:52:40+04:00'); // 21-11-2025 19:52:40 Asia/Tbilisi
    const actualUpdateTime = new Date(booking.updated_at);
    const timeDiff = Math.abs(actualUpdateTime - expectedUpdateTime);
    
    console.log('\n⏰ 3. Время обновления:');
    console.log('-'.repeat(80));
    console.log(`   Ожидалось: ${expectedUpdateTime.toISOString()} (21-11-2025 19:52:40 Asia/Tbilisi)`);
    console.log(`   В БД: ${actualUpdateTime.toISOString()} (${actualUpdateTime.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })})`);
    
    if (timeDiff < 60000) { // Разница меньше 1 минуты
      console.log('✅ Время обновления совпадает');
    } else {
      const diffMinutes = Math.floor(timeDiff / 60000);
      console.log(`⚠️  Время обновления отличается на ${diffMinutes} минут`);
    }
    
    // Проверка источника обновления
    console.log('\n🔗 4. Источник обновления:');
    console.log('-'.repeat(80));
    if (booking.updated_by_source) {
      console.log(`   Источник: ${booking.updated_by_source}`);
    } else {
      console.log('   ⚠️  Источник не указан (updated_by_source = null)');
    }
    
    if (booking.updated_by_user) {
      console.log(`   Пользователь: ${booking.updated_by_user}`);
      if (booking.updated_by_user.includes('Eliseev') || booking.updated_by_user.includes('Aleksei')) {
        console.log('   ✅ Пользователь совпадает с ожидаемым (Eliseev Aleksei Jr)');
      }
    } else {
      console.log('   ⚠️  Пользователь не указан (updated_by_user = null)');
    }
    
    // Проверка entity_timeline
    console.log('\n📜 5. История изменений из entity_timeline:');
    console.log('-'.repeat(80));
    
    const timeline = await sql`
      SELECT 
        et.id,
        et.ts,
        et.event_type,
        et.operation,
        et.summary,
        et.user_name,
        et.source_type,
        et.details
      FROM entity_timeline et
      WHERE et.entity_type = 'booking'
        AND et.entity_id = ${booking.id}
      ORDER BY et.ts DESC
      LIMIT 10
    `;
    
    if (timeline.length === 0) {
      console.log('❌ Записей в entity_timeline не найдено');
    } else {
      console.log(`Найдено записей: ${timeline.length}\n`);
      timeline.forEach((entry, idx) => {
        console.log(`${idx + 1}. ${entry.ts} (${entry.source_type})`);
        console.log(`   Событие: ${entry.event_type} / ${entry.operation || 'N/A'}`);
        console.log(`   Пользователь: ${entry.user_name || 'N/A'}`);
        console.log(`   Описание: ${entry.summary || 'N/A'}`);
        if (entry.details) {
          const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
          if (details.in_rent !== undefined) {
            console.log(`   in_rent: ${details.in_rent}`);
          }
        }
        console.log('');
      });
    }
    
    // Проверка events
    console.log('\n📨 6. События из таблицы events:');
    console.log('-'.repeat(80));
    
    const events = await sql`
      SELECT 
        e.id,
        e.ts,
        e.event_name,
        e.entity_type,
        e.operation,
        e.rentprog_id,
        e.payload,
        e.metadata
      FROM events e
      WHERE e.rentprog_id = ${rentprogId}
         OR (e.payload->>'id')::text = ${rentprogId}
         OR (e.payload->>'booking_id')::text = ${rentprogId}
      ORDER BY e.ts DESC
      LIMIT 10
    `;
    
    if (events.length === 0) {
      console.log('❌ Событий не найдено');
    } else {
      console.log(`Найдено событий: ${events.length}\n`);
      events.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.ts}`);
        console.log(`   Тип: ${event.event_name || event.entity_type || 'N/A'}`);
        console.log(`   Операция: ${event.operation || 'N/A'}`);
        console.log(`   RentProg ID: ${event.rentprog_id || 'N/A'}`);
        if (event.payload) {
          const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          if (payload.in_rent !== undefined) {
            console.log(`   in_rent: ${payload.in_rent}`);
          }
        }
        if (event.metadata) {
          const metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
          if (metadata.user_name) {
            console.log(`   Пользователь: ${metadata.user_name}`);
          }
        }
        console.log('');
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Проверка завершена');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkBooking();

