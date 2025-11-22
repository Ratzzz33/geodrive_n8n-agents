#!/usr/bin/env node
/**
 * Обработка всех существующих необработанных событий через функцию БД
 * Использует process_all_unprocessed_events() которая отправляет pg_notify
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const JARVIS_API_URL = process.env.JARVIS_API_URL || 'http://46.224.17.15:3000';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function processEvent(eventId, branch, type, extId) {
  try {
    const response = await fetch(`${JARVIS_API_URL}/process-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch: branch,
        type: type,
        ext_id: extId,
        rentprog_id: extId,
        eventId: eventId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await sql`
        UPDATE events
        SET processed = true, ok = false, reason = ${`${response.status}: ${errorText.substring(0, 500)}`}
        WHERE id = ${eventId}
      `;
      return false;
    }

    const result = await response.json();
    
    if (result.ok) {
      await sql`
        UPDATE events
        SET processed = true, ok = true
        WHERE id = ${eventId}
      `;
      return true;
    } else {
      await sql`
        UPDATE events
        SET processed = true, ok = false, reason = ${result.error || 'Unknown error'}
        WHERE id = ${eventId}
      `;
      return false;
    }
  } catch (error) {
    await sql`
      UPDATE events
      SET processed = true, ok = false, reason = ${error.message.substring(0, 500)}
      WHERE id = ${eventId}
    `;
    return false;
  }
}

async function processAllEvents() {
  console.log('\n🔄 Обработка всех необработанных событий через БД функцию\n');
  console.log('='.repeat(80));

  try {
    // Получаем статистику
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE processed = false OR processed IS NULL) as unprocessed,
        COUNT(*) FILTER (WHERE processed = true) as processed
      FROM events
    `;

    const s = stats[0];
    console.log(`📊 Статистика:`);
    console.log(`   ✅ Обработано: ${s.processed}`);
    console.log(`   ❌ Не обработано: ${s.unprocessed}\n`);

    if (s.unprocessed === 0) {
      console.log('✅ Все события уже обработаны!');
      return;
    }

    // Получаем все необработанные события
    const unprocessed = await sql`
      SELECT 
        id, ts, company_id, rentprog_id, ext_id, payload, metadata, event_name, type
      FROM events
      WHERE (processed IS NULL OR processed = FALSE)
      ORDER BY ts ASC
    `;

    console.log(`📋 Найдено ${unprocessed.length} событий для обработки\n`);

    // Подключаемся для прослушивания уведомлений
    const listenSql = postgres(CONNECTION_STRING, {
      max: 1,
      ssl: { rejectUnauthorized: false }
    });

    let processedCount = 0;
    let errorCount = 0;

    // Обрабатываем события
    for (let i = 0; i < unprocessed.length; i++) {
      const event = unprocessed[i];
      
      // Определяем branch
      const companyToBranch = {
        9247: 'tbilisi', 9248: 'kutaisi', 9506: 'batumi', 11163: 'service-center',
        11157: 'batumi', 11158: 'batumi', 9110: 'tbilisi'
      };
      
      let branch = companyToBranch[event.company_id] || 'tbilisi';
      if (event.metadata && typeof event.metadata === 'object') {
        const metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        if (metadata.branch) {
          branch = metadata.branch;
        }
      }
      
      // Извлекаем ext_id
      const extId = event.rentprog_id || event.ext_id || 
        (event.payload && typeof event.payload === 'object' 
          ? (event.payload.id || event.payload.car_id || event.payload.client_id || event.payload.booking_id)
          : null);
      
      if (!extId) {
        console.log(`   [${i + 1}/${unprocessed.length}] ⚠️  Событие ${event.id}: пропущено (нет ext_id)`);
        await sql`
          UPDATE events
          SET processed = true, ok = false, reason = 'No ext_id found'
          WHERE id = ${event.id}
        `;
        errorCount++;
        continue;
      }
      
      const eventType = event.event_name || event.type || 'unknown';
      
      console.log(`   [${i + 1}/${unprocessed.length}] Обработка события ${event.id}...`);
      console.log(`      ${event.ts.toISOString()} - ${eventType} (${extId}) в ${branch}`);
      
      const success = await processEvent(event.id, branch, eventType, String(extId));
      
      if (success) {
        processedCount++;
        console.log(`      ✅ Успешно\n`);
      } else {
        errorCount++;
        console.log(`      ❌ Ошибка\n`);
      }
      
      // Небольшая задержка
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:\n');
    console.log(`   ✅ Успешно обработано: ${processedCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📋 Всего обработано: ${processedCount + errorCount}\n`);

    // Проверяем оставшиеся
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE processed = false OR processed IS NULL
    `;

    console.log(`📋 Осталось необработанных: ${remaining[0].count}\n`);

    if (remaining[0].count === 0) {
      console.log('✅ Все события обработаны!\n');
    }

    await listenSql.end();

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

processAllEvents().catch(console.error);

