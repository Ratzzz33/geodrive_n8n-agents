#!/usr/bin/env node
/**
 * Служба для прослушивания pg_notify и обработки событий
 * Запускается как постоянно работающий сервис
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
    console.log(`[${new Date().toISOString()}] Обработка события ${eventId}: ${type} (${extId}) в ${branch}`);
    
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
      console.error(`  ❌ Ошибка: ${response.status} - ${errorText.substring(0, 200)}`);
      
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
      
      console.log(`  ✅ Успешно обработано`);
      return true;
    } else {
      await sql`
        UPDATE events
        SET processed = true, ok = false, reason = ${result.error || 'Unknown error'}
        WHERE id = ${eventId}
      `;
      
      console.error(`  ❌ Ошибка обработки: ${result.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Критическая ошибка: ${error.message}`);
    
    await sql`
      UPDATE events
      SET processed = true, ok = false, reason = ${error.message.substring(0, 500)}
      WHERE id = ${eventId}
    `;
    
    return false;
  }
}

async function startListener() {
  console.log('\n🔔 Запуск слушателя pg_notify для автоматической обработки событий\n');
  console.log('='.repeat(80));
  console.log(`Jarvis API: ${JARVIS_API_URL}`);
  console.log('='.repeat(80) + '\n');

  // Подключаемся к БД для LISTEN
  const listenSql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false }
  });

  // Подписываемся на уведомления
  await listenSql.unsafe('LISTEN rentprog_event_processed');

  console.log('✅ Подписан на канал rentprog_event_processed\n');
  console.log('Ожидание событий...\n');

  // Обработчик уведомлений
  listenSql.listen('rentprog_event_processed', (payload) => {
    if (!payload) return;
    
    // Формат: event_id|branch|type|ext_id
    const parts = payload.split('|');
    if (parts.length !== 4) {
      console.error(`⚠️  Неверный формат уведомления: ${payload}`);
      return;
    }
    
    const [eventId, branch, type, extId] = parts;
    
    // Обрабатываем асинхронно
    processEvent(parseInt(eventId), branch, type, extId).catch(err => {
      console.error(`❌ Ошибка обработки события ${eventId}:`, err);
    });
  });

  // Обрабатываем все существующие необработанные события при старте
  console.log('📋 Обработка существующих необработанных событий...\n');
  
  const unprocessed = await sql`
    SELECT id, company_id, rentprog_id, ext_id, payload, metadata, event_name, type
    FROM events
    WHERE (processed IS NULL OR processed = FALSE)
    ORDER BY ts ASC
    LIMIT 100
  `;

  console.log(`Найдено ${unprocessed.length} необработанных событий\n`);

  for (const event of unprocessed) {
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
      console.log(`⚠️  Событие ${event.id}: пропущено (нет ext_id)`);
      await sql`
        UPDATE events
        SET processed = true, ok = false, reason = 'No ext_id found'
        WHERE id = ${event.id}
      `;
      continue;
    }
    
    const eventType = event.event_name || event.type || 'unknown';
    
    await processEvent(event.id, branch, eventType, String(extId));
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n✅ Слушатель запущен и готов к работе\n');
  console.log('Для остановки нажмите Ctrl+C\n');

  // Обработка сигналов для корректного завершения
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Остановка слушателя...');
    await listenSql.end();
    await sql.end();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Остановка слушателя...');
    await listenSql.end();
    await sql.end();
    process.exit(0);
  });
}

startListener().catch(console.error);

