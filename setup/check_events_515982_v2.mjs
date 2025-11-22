#!/usr/bin/env node

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkEvents() {
  try {
    const rentprogId = 515982;
    console.log(`🔍 Поиск событий для брони RentProg ID: ${rentprogId}\n`);
    
    // Пробуем найти хоть какие-то события, используя структуру из check_booking_515117.mjs
    const events = await sql`
      SELECT 
        id,
        ts,
        event_name,
        entity_type,
        operation,
        payload,
        metadata
      FROM events
      WHERE (payload->>'id')::text = ${rentprogId.toString()}
         OR (payload->>'booking_id')::text = ${rentprogId.toString()}
         OR (payload->'data'->>'id')::text = ${rentprogId.toString()}
         OR rentprog_id::text = ${rentprogId.toString()}
      ORDER BY ts DESC
    `;

    if (events.length === 0) {
      console.log('❌ Событий не найдено');
    } else {
      console.log(`Найдено событий: ${events.length}\n`);
      events.forEach((e, idx) => {
        console.log(`${idx + 1}. Тип: ${e.event_name || e.entity_type}`);
        console.log(`   Время: ${new Date(e.ts).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
        console.log(`   Операция: ${e.operation}`);
        if (e.metadata && e.metadata.user_name) {
          console.log(`   Пользователь: ${e.metadata.user_name}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

checkEvents();

