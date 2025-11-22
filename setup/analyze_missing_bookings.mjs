#!/usr/bin/env node

/**
 * Analyze why bookings are missing from database
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = [
  '515042', '515008', '514944', '514378', '513772', '511419',
  '515310', '515285', '515271', '515201', '515117', '515049',
  '514919', '514480', '514303', '514030', '513985', '513928',
  '512915', '512491', '511974', '511520'
];

async function analyze() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Анализ отсутствующих броней...\n');

    // 1. Проверить, есть ли эти брони в таблице bookings без external_refs
    console.log('1️⃣ Проверка броней без external_refs:\n');
    const bookingsWithoutRefs = await sql`
      SELECT 
        b.id,
        b.status,
        b.start_at,
        b.end_at,
        b.data
      FROM bookings b
      WHERE b.data::text LIKE ANY(${missingIds.map(id => `%${id}%`)}) 
         OR b.data->>'id' = ANY(${missingIds})
         OR b.data->>'booking_id' = ANY(${missingIds})
      LIMIT 50
    `;

    if (bookingsWithoutRefs.length > 0) {
      console.log(`Найдено броней без external_refs: ${bookingsWithoutRefs.length}`);
      bookingsWithoutRefs.forEach((b, idx) => {
        console.log(`  [${idx + 1}] ID: ${b.id} | Статус: ${b.status || 'NULL'}`);
        if (b.data) {
          const data = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
          if (data.id || data.booking_id) {
            console.log(`      RentProg ID в data: ${data.id || data.booking_id}`);
          }
        }
      });
    } else {
      console.log('❌ Брони без external_refs не найдены');
    }

    // 2. Проверить события в таблице events для этих броней
    console.log('\n2️⃣ Проверка событий в таблице events:\n');
    const events = await sql`
      SELECT 
        id,
        ts,
        type,
        event_name,
        entity_type,
        rentprog_id,
        ext_id,
        processed
      FROM events
      WHERE (rentprog_id = ANY(${missingIds}) OR ext_id = ANY(${missingIds}))
        AND (entity_type = 'booking' OR type LIKE '%booking%' OR event_name LIKE '%booking%')
      ORDER BY ts DESC
      LIMIT 50
    `;

    if (events.length > 0) {
      console.log(`Найдено событий: ${events.length}`);
      events.forEach((e, idx) => {
        console.log(`  [${idx + 1}] ID: ${e.id} | ${e.ts.toISOString()}`);
        console.log(`      Тип: ${e.type || e.event_name || 'NULL'}`);
        console.log(`      RentProg ID: ${e.rentprog_id || e.ext_id || 'NULL'}`);
        console.log(`      Обработано: ${e.processed ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ События для этих броней не найдены');
    }

    // 3. Проверить историю операций
    console.log('\n3️⃣ Проверка истории операций:\n');
    const history = await sql`
      SELECT 
        id,
        created_at,
        operation_type,
        entity_type,
        entity_id,
        description,
        processed
      FROM history
      WHERE entity_type = 'booking'
        AND entity_id = ANY(${missingIds})
      ORDER BY created_at DESC
      LIMIT 50
    `;

    if (history.length > 0) {
      console.log(`Найдено записей в history: ${history.length}`);
      history.forEach((h, idx) => {
        console.log(`  [${idx + 1}] ID: ${h.id} | ${h.created_at ? new Date(h.created_at).toISOString() : 'NULL'}`);
        console.log(`      Операция: ${h.operation_type || 'NULL'}`);
        console.log(`      Entity ID: ${h.entity_id || 'NULL'}`);
        console.log(`      Обработано: ${h.processed ? '✅' : '❌'}`);
        console.log(`      Описание: ${(h.description || '').substring(0, 80)}...`);
      });
    } else {
      console.log('❌ Записи в history не найдены');
    }

    // 4. Проверить последние синхронизированные брони
    console.log('\n4️⃣ Последние синхронизированные брони (для сравнения):\n');
    const recentBookings = await sql`
      SELECT 
        er.external_id as rentprog_booking_id,
        b.status,
        b.start_at,
        b.created_at
      FROM external_refs er
      JOIN bookings b ON b.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id::INTEGER >= 510000
      ORDER BY er.external_id::INTEGER DESC
      LIMIT 10
    `;

    if (recentBookings.length > 0) {
      console.log('Последние синхронизированные брони:');
      recentBookings.forEach((b, idx) => {
        console.log(`  [${idx + 1}] #${b.rentprog_booking_id} | Статус: ${b.status || 'NULL'} | Создана: ${b.created_at ? new Date(b.created_at).toISOString() : 'NULL'}`);
      });
    }

    // 5. Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ВЫВОД:\n');

    if (events.length === 0 && history.length === 0) {
      console.log('❌ ПРОБЛЕМА: Брони не синхронизированы');
      console.log('\nПричины:');
      console.log('   1. События для этих броней не попали в таблицу events');
      console.log('   2. История операций не содержит эти брони');
      console.log('   3. Брони не были обработаны workflow');
      console.log('\n💡 Рекомендации:');
      console.log('   1. Проверить работу workflow "RentProg Webhooks Monitor"');
      console.log('   2. Проверить работу workflow "RentProg Upsert Processor"');
      console.log('   3. Запустить ручную синхронизацию броней');
    } else if (events.length > 0 && events.filter(e => !e.processed).length > 0) {
      console.log('⚠️ События есть, но не обработаны');
      console.log(`   Необработанных событий: ${events.filter(e => !e.processed).length}`);
      console.log('\n💡 Рекомендации:');
      console.log('   1. Проверить работу workflow "RentProg Upsert Processor"');
      console.log('   2. Проверить работу eventProcessor в Jarvis API');
    } else if (history.length > 0 && history.filter(h => !h.processed).length > 0) {
      console.log('⚠️ История есть, но не обработана');
      console.log(`   Необработанных записей: ${history.filter(h => !h.processed).length}`);
      console.log('\n💡 Рекомендации:');
      console.log('   1. Проверить работу триггера auto_process_history_trigger');
      console.log('   2. Проверить работу historyEventProcessor в Jarvis API');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

analyze().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

