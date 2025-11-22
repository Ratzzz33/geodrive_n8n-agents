#!/usr/bin/env node
/**
 * Полная проверка истории изменений для автомобиля № 61630
 * Проверяем все таблицы: events, entity_timeline, history
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function checkFullHistory() {
  console.log('\n🔍 Полная проверка истории для автомобиля № 61630\n');
  console.log('='.repeat(80));

  try {
    // 1. Найти автомобиль через external_refs
    console.log('\n📋 1. Поиск автомобиля в БД:\n');
    
    const carRef = await sql`
      SELECT 
        er.entity_id,
        er.external_id,
        c.model,
        c.plate,
        c.data->>'company_id' as company_id_in_data
      FROM external_refs er
      LEFT JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.external_id = '61630'
      LIMIT 1
    `;

    if (carRef.length === 0) {
      console.log('   ❌ Автомобиль не найден в external_refs');
    } else {
      const ref = carRef[0];
      console.log(`   ✅ Автомобиль найден:`);
      console.log(`      UUID: ${ref.entity_id}`);
      console.log(`      Модель: ${ref.model || 'null'}`);
      console.log(`      Номер: ${ref.plate || 'null'}`);
      console.log(`      Company ID в data: ${ref.company_id_in_data || 'null'}`);
    }

    // 2. Событие от 14 ноября в events
    console.log('\n📋 2. Событие от 14 ноября в таблице events:\n');
    
    const event = await sql`
      SELECT 
        id,
        ts,
        event_name,
        entity_type,
        operation,
        rentprog_id,
        company_id,
        payload,
        processed,
        ok
      FROM events
      WHERE rentprog_id = '61630'
        AND ts::date = '2025-11-14'::date
      ORDER BY ts DESC
      LIMIT 1
    `;

    if (event.length > 0) {
      const e = event[0];
      console.log(`   ✅ Событие найдено (ID: ${e.id})`);
      console.log(`      Время: ${e.ts.toISOString()}`);
      console.log(`      Тип: ${e.event_name}`);
      console.log(`      Company ID в записи: ${e.company_id}`);
      console.log(`      Обработано: ${e.processed ? '✅' : '❌'}`);
      
      const payload = typeof e.payload === 'string' 
        ? JSON.parse(e.payload) 
        : e.payload;
      
      if (payload.company_id && Array.isArray(payload.company_id)) {
        console.log(`      Изменение company_id: ${payload.company_id[0]} → ${payload.company_id[1]}`);
      }
    } else {
      console.log('   ❌ Событие не найдено');
    }

    // 3. Проверка entity_timeline (если таблица существует)
    console.log('\n📋 3. Проверка entity_timeline:\n');
    
    try {
      const timeline = await sql`
        SELECT 
          id,
          ts,
          event_type,
          operation,
          summary,
          details,
          user_name,
          source_type
        FROM entity_timeline
        WHERE entity_type = 'car'
          AND entity_id = (
            SELECT entity_id 
            FROM external_refs 
            WHERE system = 'rentprog' 
              AND external_id = '61630'
            LIMIT 1
          )
          AND ts::date = '2025-11-14'::date
        ORDER BY ts DESC
        LIMIT 5
      `;

      if (timeline.length === 0) {
        console.log('   ⚠️  Записей в entity_timeline не найдено (возможно, таблица пуста или событие не обработано)');
      } else {
        console.log(`   ✅ Найдено записей: ${timeline.length}`);
        for (const t of timeline) {
          console.log(`      ${t.ts.toISOString()} - ${t.event_type} (${t.operation})`);
          if (t.user_name) {
            console.log(`         Пользователь: ${t.user_name}`);
          }
          if (t.summary) {
            console.log(`         Описание: ${t.summary}`);
          }
        }
      }
    } catch (err) {
      console.log(`   ⚠️  Ошибка при проверке entity_timeline: ${err.message}`);
    }

    // 4. Проверка history (если таблица существует)
    console.log('\n📋 4. Проверка таблицы history:\n');
    
    try {
      const history = await sql`
        SELECT 
          id,
          ts,
          operation_type,
          description,
          entity_id,
          raw_data
        FROM history
        WHERE entity_id = '61630'
          AND ts::date = '2025-11-14'::date
        ORDER BY ts DESC
        LIMIT 5
      `;

      if (history.length === 0) {
        console.log('   ⚠️  Записей в history не найдено');
      } else {
        console.log(`   ✅ Найдено записей: ${history.length}`);
        for (const h of history) {
          console.log(`      ${h.ts.toISOString()} - ${h.operation_type}`);
          if (h.description) {
            console.log(`         Описание: ${h.description}`);
          }
        }
      }
    } catch (err) {
      console.log(`   ⚠️  Ошибка при проверке history: ${err.message}`);
    }

    // 5. Все события для этого автомобиля (последние 20)
    console.log('\n📋 5. Все события для автомобиля 61630 (последние 20):\n');
    
    const allEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        company_id,
        processed,
        payload->>'company_id' as company_id_in_payload
      FROM events
      WHERE rentprog_id = '61630'
      ORDER BY ts DESC
      LIMIT 20
    `;

    console.log(`   Всего событий: ${allEvents.length}`);
    for (const ev of allEvents) {
      const processed = ev.processed ? '✅' : '❌';
      console.log(`   ${ev.ts.toISOString()} - ${ev.event_name} (company_id: ${ev.company_id}, processed: ${processed})`);
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

checkFullHistory().catch(console.error);

