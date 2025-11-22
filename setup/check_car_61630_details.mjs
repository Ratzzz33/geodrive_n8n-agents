#!/usr/bin/env node
/**
 * Детальная проверка события от 14 ноября для автомобиля № 61630
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function checkDetails() {
  console.log('\n🔍 Детальная проверка события от 14 ноября 2025\n');
  console.log('='.repeat(80));

  try {
    const event = await sql`
      SELECT 
        id,
        ts,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        type,
        payload,
        metadata,
        processed,
        ok,
        reason
      FROM events
      WHERE rentprog_id = '61630'
        AND ts::date = '2025-11-14'::date
      ORDER BY ts DESC
      LIMIT 1
    `;

    if (event.length === 0) {
      console.log('❌ Событие не найдено');
      return;
    }

    const e = event[0];
    console.log('\n📋 Полная информация о событии:\n');
    console.log(`ID: ${e.id}`);
    console.log(`Время: ${e.ts.toISOString()}`);
    console.log(`Тип события: ${e.event_name || e.type}`);
    console.log(`Сущность: ${e.entity_type}`);
    console.log(`Операция: ${e.operation}`);
    console.log(`RentProg ID: ${e.rentprog_id}`);
    console.log(`Company ID в записи: ${e.company_id}`);
    console.log(`Обработано: ${e.processed ? '✅' : '❌'}`);
    console.log(`Успешно: ${e.ok ? '✅' : '❌'}`);
    if (e.reason) {
      console.log(`Причина ошибки: ${e.reason}`);
    }

    console.log('\n📦 Payload (полный):\n');
    const payload = typeof e.payload === 'string' 
      ? JSON.parse(e.payload) 
      : e.payload;
    
    console.log(JSON.stringify(payload, null, 2));

    console.log('\n📦 Metadata:\n');
    if (e.metadata) {
      const metadata = typeof e.metadata === 'string' 
        ? JSON.parse(e.metadata) 
        : e.metadata;
      console.log(JSON.stringify(metadata, null, 2));
    } else {
      console.log('   (отсутствует)');
    }

    // Проверяем наличие изменений
    console.log('\n🔄 Анализ изменений:\n');
    
    if (payload.company_id) {
      console.log(`   company_id: ${JSON.stringify(payload.company_id)}`);
      if (Array.isArray(payload.company_id)) {
        console.log(`   → Массив значений: [${payload.company_id.join(', ')}]`);
        if (payload.company_id.length === 2) {
          console.log(`   → Изменение с ${payload.company_id[0]} на ${payload.company_id[1]}`);
        }
      } else if (typeof payload.company_id === 'string' && payload.company_id.includes(',')) {
        console.log(`   → Строка с несколькими значениями: ${payload.company_id}`);
      }
    }

    if (payload.mileage) {
      console.log(`   mileage: ${JSON.stringify(payload.mileage)}`);
      if (Array.isArray(payload.mileage)) {
        console.log(`   → Массив значений: [${payload.mileage.join(', ')}]`);
        if (payload.mileage.length === 2) {
          console.log(`   → Изменение с ${payload.mileage[0]} на ${payload.mileage[1]}`);
        }
      }
    }

    if (payload.changes) {
      console.log(`   changes: ${JSON.stringify(payload.changes, null, 2)}`);
    }

    if (payload.changed_fields) {
      console.log(`   changed_fields: ${JSON.stringify(payload.changed_fields, null, 2)}`);
    }

    // Проверяем все остальные события для этого автомобиля
    console.log('\n📋 Все события для этого автомобиля (последние 10):\n');
    
    const allEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        company_id,
        processed
      FROM events
      WHERE rentprog_id = '61630'
      ORDER BY ts DESC
      LIMIT 10
    `;

    for (const ev of allEvents) {
      console.log(`   ${ev.ts.toISOString()} - ${ev.event_name || 'unknown'} (company_id: ${ev.company_id}, processed: ${ev.processed})`);
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

checkDetails().catch(console.error);

