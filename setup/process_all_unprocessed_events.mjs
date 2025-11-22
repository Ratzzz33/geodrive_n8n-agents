#!/usr/bin/env node
/**
 * Обработка ВСЕХ необработанных событий по порядку (от старых к свежим)
 * Вносит изменения в соответствующие таблицы через Jarvis API
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const JARVIS_API_URL = process.env.JARVIS_API_URL || 'http://46.224.17.15:3000';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Маппинг company_id -> branch
const companyToBranch = {
  9247: 'tbilisi',
  9248: 'kutaisi',
  9506: 'batumi',
  11163: 'service-center',
  11157: 'batumi', // Возможно новый ID для Batumi
  11158: 'batumi',
  9110: 'tbilisi',
};

async function processAllEvents() {
  console.log('\n🔄 Обработка ВСЕХ необработанных событий\n');
  console.log('='.repeat(80));

  try {
    // 1. Получить статистику
    console.log('\n📊 Статистика необработанных событий:\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = false OR processed IS NULL) as unprocessed,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        MIN(ts) FILTER (WHERE processed = false OR processed IS NULL) as oldest_unprocessed,
        MAX(ts) FILTER (WHERE processed = false OR processed IS NULL) as newest_unprocessed
      FROM events
    `;

    const s = stats[0];
    console.log(`   Всего событий: ${s.total}`);
    console.log(`   ✅ Обработано: ${s.processed}`);
    console.log(`   ❌ Не обработано: ${s.unprocessed}`);
    if (s.oldest_unprocessed) {
      console.log(`   📅 Самое старое необработанное: ${s.oldest_unprocessed.toISOString()}`);
    }
    if (s.newest_unprocessed) {
      console.log(`   📅 Самое свежее необработанное: ${s.newest_unprocessed.toISOString()}`);
    }

    if (s.unprocessed === 0) {
      console.log('\n✅ Все события уже обработаны!');
      return;
    }

    // 2. Получить все необработанные события по порядку (от старых к свежим)
    console.log('\n📋 Получение списка необработанных событий...\n');
    
    const unprocessed = await sql`
      SELECT 
        id,
        ts,
        type,
        event_name,
        entity_type,
        operation,
        ext_id,
        rentprog_id,
        company_id,
        payload,
        metadata
      FROM events
      WHERE processed = false OR processed IS NULL
      ORDER BY ts ASC
    `;

    console.log(`   Найдено ${unprocessed.length} событий для обработки\n`);

    // 3. Обработать каждое событие
    let processed = 0;
    let errors = 0;
    const errorDetails = [];

    for (let i = 0; i < unprocessed.length; i++) {
      const event = unprocessed[i];
      
      try {
        // Определить branch
        let branch = 'tbilisi'; // по умолчанию
        if (event.company_id && companyToBranch[event.company_id]) {
          branch = companyToBranch[event.company_id];
        } else if (event.metadata && typeof event.metadata === 'object') {
          const metadata = typeof event.metadata === 'string' 
            ? JSON.parse(event.metadata) 
            : event.metadata;
          if (metadata.branch) {
            branch = metadata.branch;
          }
        }

        // Определить ext_id
        const extId = event.rentprog_id || event.ext_id || 
          (event.payload && typeof event.payload === 'object' 
            ? (event.payload.id || event.payload.car_id || event.payload.client_id || event.payload.booking_id)
            : null);

        if (!extId) {
          console.log(`   ⚠️  Событие ${event.id}: пропущено (нет ext_id)`);
          // Пометить как обработанное, но с ошибкой
          await sql`
            UPDATE events
            SET processed = true, ok = false, reason = 'No ext_id found'
            WHERE id = ${event.id}
          `;
          errors++;
          continue;
        }

        // Определить type события
        const eventType = event.event_name || event.type || 'unknown';

        console.log(`   [${i + 1}/${unprocessed.length}] Обработка события ${event.id}...`);
        console.log(`      Время: ${event.ts.toISOString()}`);
        console.log(`      Тип: ${eventType}`);
        console.log(`      Branch: ${branch}`);
        console.log(`      Ext ID: ${extId}`);

        // Вызов Jarvis API
        const response = await fetch(`${JARVIS_API_URL}/process-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branch: branch,
            type: eventType,
            ext_id: String(extId),
            eventId: event.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`      ❌ Ошибка: ${response.status} - ${errorText.substring(0, 200)}`);
          
          // Пометить как обработанное, но с ошибкой
          await sql`
            UPDATE events
            SET processed = true, ok = false, reason = ${`${response.status}: ${errorText.substring(0, 500)}`}
            WHERE id = ${event.id}
          `;
          
          errors++;
          errorDetails.push({
            id: event.id,
            ts: event.ts,
            error: `${response.status}: ${errorText.substring(0, 200)}`
          });
          continue;
        }

        const result = await response.json();
        
        if (result.ok) {
          // Пометить как успешно обработанное
          await sql`
            UPDATE events
            SET processed = true, ok = true
            WHERE id = ${event.id}
          `;
          
          processed++;
          console.log(`      ✅ Успешно обработано`);
          if (result.entityId) {
            console.log(`         Entity ID: ${result.entityId}`);
          }
        } else {
          console.error(`      ❌ Ошибка обработки: ${result.error || 'Unknown error'}`);
          
          // Пометить как обработанное, но с ошибкой
          await sql`
            UPDATE events
            SET processed = true, ok = false, reason = ${result.error || 'Unknown error'}
            WHERE id = ${event.id}
          `;
          
          errors++;
          errorDetails.push({
            id: event.id,
            ts: event.ts,
            error: result.error || 'Unknown error'
          });
        }

        // Небольшая задержка между запросами (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`      ❌ Критическая ошибка: ${error.message}`);
        
        // Пометить как обработанное, но с ошибкой
        await sql`
          UPDATE events
          SET processed = true, ok = false, reason = ${error.message.substring(0, 500)}
          WHERE id = ${event.id}
        `;
        
        errors++;
        errorDetails.push({
          id: event.id,
          ts: event.ts,
          error: error.message
        });
      }
    }

    // 4. Итоговая статистика
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:\n');
    console.log(`   ✅ Успешно обработано: ${processed}`);
    console.log(`   ❌ Ошибок: ${errors}`);
    console.log(`   📋 Всего обработано: ${processed + errors}`);

    if (errorDetails.length > 0) {
      console.log('\n❌ Детали ошибок (первые 10):\n');
      errorDetails.slice(0, 10).forEach(err => {
        console.log(`   ID ${err.id} (${err.ts.toISOString()}): ${err.error}`);
      });
      if (errorDetails.length > 10) {
        console.log(`   ... и еще ${errorDetails.length - 10} ошибок`);
      }
    }

    // 5. Проверить оставшиеся необработанные события
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE processed = false OR processed IS NULL
    `;

    console.log(`\n📋 Осталось необработанных: ${remaining[0].count}`);

    if (remaining[0].count > 0) {
      console.log('\n💡 Запустите скрипт снова для обработки оставшихся событий');
    } else {
      console.log('\n✅ Все события обработаны!');
    }

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

processAllEvents().catch(console.error);

