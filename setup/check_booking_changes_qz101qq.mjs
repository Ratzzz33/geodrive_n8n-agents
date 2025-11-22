#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkBookingChanges() {
  try {
    const plate = 'QZ101QQ';
    const bookingId = '559cb090-0bdb-4eef-a3ad-7ef9c51d1cc0'; // ID ближайшей брони
    
    console.log('🔍 Проверка истории изменений брони QZ101QQ\n');
    console.log('='.repeat(80));
    
    // 1. Найти автомобиль
    const cars = await sql`
      SELECT c.id, c.plate, er.external_id as rentprog_id
      FROM cars c
      LEFT JOIN external_refs er ON er.entity_id = c.id 
        AND er.entity_type = 'car' 
        AND er.system = 'rentprog'
      WHERE UPPER(REPLACE(c.plate, ' ', '')) = UPPER(REPLACE(${plate}, ' ', ''))
    `;
    
    if (cars.length === 0) {
      console.log('❌ Автомобиль не найден');
      return;
    }
    
    const car = cars[0];
    console.log(`✅ Автомобиль найден: ${car.plate} (RentProg ID: ${car.rentprog_id})\n`);
    
    // 2. Получить информацию о брони
    const bookings = await sql`
      SELECT 
        b.id,
        b.start_at,
        b.end_at,
        b.start_date,
        b.end_date,
        b.status,
        b.state,
        b.updated_by_source,
        b.updated_by_user,
        b.updated_by_workflow,
        b.data
      FROM bookings b
      WHERE b.id = ${bookingId}
    `;
    
    if (bookings.length === 0) {
      console.log('❌ Бронь не найдена');
      return;
    }
    
    const booking = bookings[0];
    console.log('📋 Информация о брони:');
    console.log(`   ID: ${booking.id}`);
    console.log(`   start_at: ${booking.start_at}`);
    console.log(`   end_at: ${booking.end_at}`);
    console.log(`   start_date: ${booking.start_date}`);
    console.log(`   end_date: ${booking.end_date}`);
    console.log(`   status: ${booking.status}`);
    console.log(`   state: ${booking.state}`);
    console.log(`   updated_by_source: ${booking.updated_by_source || 'не указан'}`);
    console.log(`   updated_by_user: ${booking.updated_by_user || 'не указан'}`);
    console.log(`   updated_by_workflow: ${booking.updated_by_workflow || 'не указан'}`);
    
    // 3. Проверить entity_timeline
    console.log('\n📜 История изменений из entity_timeline:');
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
        AND et.entity_id = ${bookingId}
      ORDER BY et.ts DESC
      LIMIT 20
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
          if (details.changes) {
            console.log(`   Изменения:`);
            Object.entries(details.changes).forEach(([key, value]) => {
              console.log(`      ${key}: ${value.old || 'null'} → ${value.new || 'null'}`);
            });
          }
        }
        console.log('');
      });
    }
    
    // 4. Проверить events
    console.log('\n📨 События из таблицы events:');
    console.log('-'.repeat(80));
    
    const events = await sql`
      SELECT 
        e.id,
        e.ts,
        e.event_type,
        e.source,
        e.branch,
        e.user_name,
        e.event_data
      FROM events e
      WHERE e.event_data->>'booking_id' = ${bookingId}
         OR e.event_data->>'id' = ${bookingId}
         OR (e.event_data->>'car_id' = ${car.id}::text AND e.event_type LIKE '%booking%')
      ORDER BY e.ts DESC
      LIMIT 20
    `;
    
    if (events.length === 0) {
      console.log('❌ Событий не найдено');
    } else {
      console.log(`Найдено событий: ${events.length}\n`);
      events.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.ts} (${event.source})`);
        console.log(`   Тип: ${event.event_type}`);
        console.log(`   Пользователь: ${event.user_name || 'N/A'}`);
        console.log(`   Филиал: ${event.branch || 'N/A'}`);
        if (event.event_data) {
          const data = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
          if (data.start_date || data.end_date || data.start_at || data.end_at) {
            console.log(`   Даты:`);
            if (data.start_date) console.log(`      start_date: ${data.start_date}`);
            if (data.end_date) console.log(`      end_date: ${data.end_date}`);
            if (data.start_at) console.log(`      start_at: ${data.start_at}`);
            if (data.end_at) console.log(`      end_at: ${data.end_at}`);
          }
        }
        console.log('');
      });
    }
    
    // 5. Проверить history
    console.log('\n📚 История из таблицы history:');
    console.log('-'.repeat(80));
    
    const history = await sql`
      SELECT 
        h.id,
        h.created_at,
        h.description,
        h.user_name,
        h.branch,
        h.raw_data
      FROM history h
      WHERE h.raw_data->>'booking_id' = ${bookingId}
         OR h.raw_data->>'id' = ${bookingId}
         OR h.description ILIKE '%${plate}%'
      ORDER BY h.created_at DESC
      LIMIT 20
    `;
    
    if (history.length === 0) {
      console.log('❌ Записей в history не найдено');
    } else {
      console.log(`Найдено записей: ${history.length}\n`);
      history.forEach((entry, idx) => {
        console.log(`${idx + 1}. ${entry.created_at} (${entry.branch || 'N/A'})`);
        console.log(`   Пользователь: ${entry.user_name || 'N/A'}`);
        console.log(`   Описание: ${entry.description || 'N/A'}`);
        if (entry.raw_data) {
          const data = typeof entry.raw_data === 'string' ? JSON.parse(entry.raw_data) : entry.raw_data;
          if (data.start_date || data.end_date || data.start_at || data.end_at) {
            console.log(`   Даты:`);
            if (data.start_date) console.log(`      start_date: ${data.start_date}`);
            if (data.end_date) console.log(`      end_date: ${data.end_date}`);
            if (data.start_at) console.log(`      start_at: ${data.start_at}`);
            if (data.end_at) console.log(`      end_at: ${data.end_at}`);
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

checkBookingChanges();

