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
    
    // Ищем в events по payload->id или payload->booking_id
    const events = await sql`
      SELECT 
        id,
        event_name,
        status,
        created_at,
        processed_at,
        error,
        payload
      FROM events
      WHERE (payload->>'id')::text = ${rentprogId.toString()}
         OR (payload->>'booking_id')::text = ${rentprogId.toString()}
         OR (payload->'data'->>'id')::text = ${rentprogId.toString()}
      ORDER BY created_at DESC
    `;

    if (events.length === 0) {
      console.log('❌ Событий не найдено');
    } else {
      console.log(`Найдено событий: ${events.length}\n`);
      events.forEach((e, idx) => {
        console.log(`${idx + 1}. Тип: ${e.event_name}`);
        console.log(`   Статус: ${e.status}`);
        console.log(`   Создано: ${new Date(e.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
        if (e.processed_at) {
          console.log(`   Обработано: ${new Date(e.processed_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}`);
        }
        if (e.error) {
          console.log(`   Ошибка: ${e.error}`);
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

