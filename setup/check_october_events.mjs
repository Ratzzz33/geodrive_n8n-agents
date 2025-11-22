#!/usr/bin/env node
/**
 * Проверка событий за октябрь 2025 для автомобиля № 61630
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function checkOctoberEvents() {
  console.log('\n🔍 Проверка событий за октябрь 2025 для автомобиля № 61630\n');
  console.log('='.repeat(80));

  try {
    // Все события за октябрь
    console.log('\n📋 Все события за октябрь 2025:\n');
    
    const octoberEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        company_id,
        payload,
        processed
      FROM events
      WHERE rentprog_id = '61630'
        AND ts >= '2025-10-01'::date
        AND ts < '2025-11-01'::date
      ORDER BY ts DESC
    `;

    if (octoberEvents.length === 0) {
      console.log('   ❌ События за октябрь не найдены');
    } else {
      console.log(`   ✅ Найдено событий: ${octoberEvents.length}\n`);
      
      for (const event of octoberEvents) {
        const payload = typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload;
        
        console.log(`   📅 ${event.ts.toISOString()} (${event.ts.toLocaleDateString('ru-RU')})`);
        console.log(`      Тип: ${event.event_name || 'unknown'}`);
        console.log(`      Company ID: ${event.company_id || 'null'}`);
        console.log(`      Обработано: ${event.processed ? '✅' : '❌'}`);
        
        if (payload.company_id) {
          if (Array.isArray(payload.company_id)) {
            console.log(`      📌 company_id: [${payload.company_id.join(', ')}]`);
          } else {
            console.log(`      📌 company_id: ${payload.company_id}`);
          }
        }
        
        if (payload.mileage) {
          if (Array.isArray(payload.mileage)) {
            console.log(`      📌 mileage: [${payload.mileage.join(', ')}]`);
          } else {
            console.log(`      📌 mileage: ${payload.mileage}`);
          }
        }
        
        console.log('');
      }
    }

    // Проверка самого раннего события для этого автомобиля
    console.log('\n📋 Самое раннее событие для автомобиля № 61630:\n');
    
    const earliest = await sql`
      SELECT 
        id,
        ts,
        event_name,
        company_id
      FROM events
      WHERE rentprog_id = '61630'
      ORDER BY ts ASC
      LIMIT 1
    `;

    if (earliest.length > 0) {
      const e = earliest[0];
      console.log(`   📅 ${e.ts.toISOString()} (${e.ts.toLocaleDateString('ru-RU')})`);
      console.log(`      Тип: ${e.event_name || 'unknown'}`);
      console.log(`      Company ID: ${e.company_id || 'null'}`);
      console.log(`\n   💡 Первое событие в БД: ${e.ts.toLocaleDateString('ru-RU')}`);
    }

    // Статистика по всем событиям
    console.log('\n📊 Статистика по всем событиям для автомобиля № 61630:\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE processed = false) as not_processed,
        MIN(ts) as first_event,
        MAX(ts) as last_event
      FROM events
      WHERE rentprog_id = '61630'
    `;

    if (stats.length > 0) {
      const s = stats[0];
      console.log(`   Всего событий: ${s.total}`);
      console.log(`   Обработано: ${s.processed}`);
      console.log(`   Не обработано: ${s.not_processed}`);
      console.log(`   Первое событие: ${s.first_event ? new Date(s.first_event).toLocaleDateString('ru-RU') : 'null'}`);
      console.log(`   Последнее событие: ${s.last_event ? new Date(s.last_event).toLocaleDateString('ru-RU') : 'null'}`);
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

checkOctoberEvents().catch(console.error);

