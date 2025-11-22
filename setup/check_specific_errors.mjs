#!/usr/bin/env node
/**
 * Детальная проверка конкретных ошибок
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkSpecificErrors() {
  console.log('\n🔍 Детальная проверка конкретных ошибок\n');
  console.log('='.repeat(80));

  try {
    // Проверяем события с ошибкой toISOString
    console.log('\n📋 1. Ошибка: value.toISOString is not a function\n');
    
    const toISOErrors = await sql`
      SELECT id, ts, event_name, type, rentprog_id, payload, reason
      FROM events
      WHERE processed = true AND ok = false 
        AND reason LIKE '%toISOString%'
      ORDER BY ts DESC
      LIMIT 5
    `;

    for (const e of toISOErrors) {
      console.log(`\n   Событие ${e.id} (${e.event_name || e.type}):`);
      const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
      
      // Проверяем даты
      if (payload.start_date) {
        console.log(`      start_date: ${JSON.stringify(payload.start_date)} (тип: ${typeof payload.start_date}, массив: ${Array.isArray(payload.start_date)})`);
      }
      if (payload.end_date) {
        console.log(`      end_date: ${JSON.stringify(payload.end_date)} (тип: ${typeof payload.end_date}, массив: ${Array.isArray(payload.end_date)})`);
      }
      if (payload.start_at) {
        console.log(`      start_at: ${JSON.stringify(payload.start_at)} (тип: ${typeof payload.start_at}, массив: ${Array.isArray(payload.start_at)})`);
      }
      if (payload.end_at) {
        console.log(`      end_at: ${JSON.stringify(payload.end_at)} (тип: ${typeof payload.end_at}, массив: ${Array.isArray(payload.end_at)})`);
      }
    }

    // Проверяем события с ошибкой UUID
    console.log('\n📋 2. Ошибка: invalid input syntax for type uuid\n');
    
    const uuidErrors = await sql`
      SELECT id, ts, event_name, type, rentprog_id, payload, reason
      FROM events
      WHERE processed = true AND ok = false 
        AND reason LIKE '%uuid%'
      ORDER BY ts DESC
      LIMIT 5
    `;

    for (const e of uuidErrors) {
      console.log(`\n   Событие ${e.id} (${e.event_name || e.type}):`);
      const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
      console.log(`      Ошибка: ${e.reason}`);
      console.log(`      Payload keys: ${Object.keys(payload).join(', ')}`);
      
      // Ищем проблемное значение в reason
      const uuidMatch = e.reason.match(/uuid: "(\d+)"/);
      if (uuidMatch) {
        const problemValue = uuidMatch[1];
        console.log(`      Проблемное значение: ${problemValue}`);
        
        // Ищем это значение в payload
        for (const [key, value] of Object.entries(payload)) {
          if (String(value) === problemValue || (Array.isArray(value) && value.includes(problemValue))) {
            console.log(`      ⚠️  Найдено в поле ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkSpecificErrors().catch(console.error);

