#!/usr/bin/env node
/**
 * Проверка событий для автомобиля № 61630 (Maserati Levante 686)
 * 
 * Ищем события об изменении:
 * - company_id с 9247 на 9506 (14 нояб. 25, 12 окт. 25)
 * - mileage с 107853 на 108721 (04 окт. 25)
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function checkCarEvents() {
  console.log('\n🔍 Поиск событий для автомобиля № 61630 (Maserati Levante 686)\n');
  console.log('=' .repeat(80));

  try {
    // 1. Все события для этого автомобиля
    console.log('\n📋 1. Все события для rentprog_id = "61630":\n');
    
    const allEvents = await sql`
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
        processed,
        ok
      FROM events
      WHERE rentprog_id = '61630'
         OR rentprog_id = '61630'
         OR payload->>'id' = '61630'
         OR payload->>'car_id' = '61630'
      ORDER BY ts DESC
      LIMIT 50
    `;

    if (allEvents.length === 0) {
      console.log('   ❌ События не найдены');
    } else {
      console.log(`   ✅ Найдено событий: ${allEvents.length}\n`);
      
      for (const event of allEvents) {
        console.log(`   📅 ${event.ts.toISOString()}`);
        console.log(`      Тип: ${event.event_name || event.type || 'unknown'}`);
        console.log(`      Сущность: ${event.entity_type || 'unknown'}`);
        console.log(`      Операция: ${event.operation || 'unknown'}`);
        console.log(`      Company ID: ${event.company_id || 'null'}`);
        console.log(`      RentProg ID: ${event.rentprog_id || 'null'}`);
        console.log(`      Обработано: ${event.processed ? '✅' : '❌'}`);
        console.log(`      Успешно: ${event.ok ? '✅' : '❌'}`);
        
        // Проверяем payload на наличие изменений
        if (event.payload) {
          const payload = typeof event.payload === 'string' 
            ? JSON.parse(event.payload) 
            : event.payload;
          
          // Проверка company_id
          if (payload.company_id !== undefined) {
            console.log(`      📌 company_id в payload: ${payload.company_id}`);
          }
          
          // Проверка mileage
          if (payload.mileage !== undefined) {
            console.log(`      📌 mileage в payload: ${JSON.stringify(payload.mileage)}`);
          }
          
          // Проверка изменений (если есть массив изменений)
          if (payload.changes || payload.changed_fields) {
            const changes = payload.changes || payload.changed_fields;
            console.log(`      📌 Изменения: ${JSON.stringify(changes)}`);
          }
        }
        
        console.log('');
      }
    }

    // 2. События с изменениями company_id
    console.log('\n📋 2. События с изменениями company_id:\n');
    
    const companyIdEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        payload,
        company_id
      FROM events
      WHERE rentprog_id = '61630'
        AND (
          payload::text LIKE '%company_id%'
          OR payload::text LIKE '%9247%'
          OR payload::text LIKE '%9506%'
        )
      ORDER BY ts DESC
    `;

    if (companyIdEvents.length === 0) {
      console.log('   ❌ События с изменениями company_id не найдены');
    } else {
      console.log(`   ✅ Найдено событий: ${companyIdEvents.length}\n`);
      
      for (const event of companyIdEvents) {
        const payload = typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload;
        
        console.log(`   📅 ${event.ts.toISOString()}`);
        console.log(`      Company ID в записи: ${event.company_id}`);
        
        if (payload.company_id) {
          console.log(`      Company ID в payload: ${payload.company_id}`);
        }
        
        // Проверяем на наличие изменений
        if (payload.changes && payload.changes.company_id) {
          const change = payload.changes.company_id;
          console.log(`      🔄 Изменение company_id: ${JSON.stringify(change)}`);
        }
        
        console.log('');
      }
    }

    // 3. События с изменениями mileage
    console.log('\n📋 3. События с изменениями mileage:\n');
    
    const mileageEvents = await sql`
      SELECT 
        id,
        ts,
        event_name,
        payload
      FROM events
      WHERE rentprog_id = '61630'
        AND (
          payload::text LIKE '%mileage%'
          OR payload::text LIKE '%107853%'
          OR payload::text LIKE '%108721%'
        )
      ORDER BY ts DESC
    `;

    if (mileageEvents.length === 0) {
      console.log('   ❌ События с изменениями mileage не найдены');
    } else {
      console.log(`   ✅ Найдено событий: ${mileageEvents.length}\n`);
      
      for (const event of mileageEvents) {
        const payload = typeof event.payload === 'string' 
          ? JSON.parse(event.payload) 
          : event.payload;
        
        console.log(`   📅 ${event.ts.toISOString()}`);
        
        if (payload.mileage) {
          console.log(`      📌 mileage: ${JSON.stringify(payload.mileage)}`);
        }
        
        // Проверяем на наличие изменений
        if (payload.changes && payload.changes.mileage) {
          const change = payload.changes.mileage;
          console.log(`      🔄 Изменение mileage: ${JSON.stringify(change)}`);
        }
        
        console.log('');
      }
    }

    // 4. Проверка по датам
    console.log('\n📋 4. Проверка по конкретным датам:\n');
    
    const dateChecks = [
      { date: '2025-11-14', desc: '14 ноября 2025 (company_id)' },
      { date: '2025-10-12', desc: '12 октября 2025 (company_id)' },
      { date: '2025-10-04', desc: '4 октября 2025 (mileage)' }
    ];

    for (const check of dateChecks) {
      const events = await sql`
        SELECT 
          id,
          ts,
          event_name,
          payload
        FROM events
        WHERE rentprog_id = '61630'
          AND ts::date = ${check.date}::date
        ORDER BY ts DESC
      `;

      if (events.length === 0) {
        console.log(`   ❌ ${check.desc}: событий не найдено`);
      } else {
        console.log(`   ✅ ${check.desc}: найдено ${events.length} событий`);
        for (const event of events) {
          console.log(`      📅 ${event.ts.toISOString()} - ${event.event_name || event.type}`);
        }
      }
      console.log('');
    }

    // 5. Проверка через external_refs (если автомобиль есть в БД)
    console.log('\n📋 5. Проверка автомобиля через external_refs:\n');
    
    const carRef = await sql`
      SELECT 
        er.entity_id,
        er.external_id,
        er.system,
        c.model,
        c.plate,
        c.company_id
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
      console.log(`      Company ID: ${ref.company_id || 'null'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('\n❌ Ошибка при проверке:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkCarEvents().catch(console.error);

