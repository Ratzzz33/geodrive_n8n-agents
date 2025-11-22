#!/usr/bin/env node
/**
 * Проверка ошибок обработки событий
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkErrors() {
  console.log('\n🔍 Анализ ошибок обработки событий\n');
  console.log('='.repeat(80));

  try {
    // Получаем события с ошибками
    const errors = await sql`
      SELECT 
        id,
        ts,
        event_name,
        type,
        entity_type,
        operation,
        rentprog_id,
        ext_id,
        company_id,
        reason,
        payload,
        metadata
      FROM events
      WHERE processed = true AND ok = false
      ORDER BY ts DESC
      LIMIT 50
    `;

    console.log(`\n📊 Найдено событий с ошибками: ${errors.length}\n`);

    if (errors.length === 0) {
      console.log('✅ Ошибок не найдено!');
      return;
    }

    // Группируем ошибки по типу
    const errorGroups = {};

    for (const error of errors) {
      const reason = error.reason || 'Unknown error';
      const errorType = reason.split(':')[0] || reason.substring(0, 50);
      
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = [];
      }
      errorGroups[errorType].push(error);
    }

    console.log('\n📋 Группировка ошибок по типам:\n');
    
    for (const [errorType, events] of Object.entries(errorGroups)) {
      console.log(`   ${errorType}: ${events.length} событий`);
    }

    // Детальный анализ каждой группы
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 Детальный анализ ошибок:\n');

    for (const [errorType, events] of Object.entries(errorGroups)) {
      console.log(`\n🔴 ${errorType} (${events.length} событий):\n`);
      
      // Показываем первые 5 примеров
      for (let i = 0; i < Math.min(5, events.length); i++) {
        const e = events[i];
        console.log(`   [${i + 1}] Событие ${e.id} (${e.ts.toISOString()})`);
        console.log(`       Тип: ${e.event_name || e.type}`);
        console.log(`       RentProg ID: ${e.rentprog_id || e.ext_id || 'null'}`);
        console.log(`       Company ID: ${e.company_id || 'null'}`);
        console.log(`       Ошибка: ${e.reason}`);
        
        // Показываем payload если есть проблемы
        if (e.payload && typeof e.payload === 'object') {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
          
          // Проверяем на массивы
          const arrayFields = [];
          for (const [key, value] of Object.entries(payload)) {
            if (Array.isArray(value)) {
              arrayFields.push(`${key}: [${value.join(', ')}]`);
            }
          }
          
          if (arrayFields.length > 0) {
            console.log(`       Массивы в payload: ${arrayFields.join(', ')}`);
          }
        }
        
        console.log('');
      }
      
      if (events.length > 5) {
        console.log(`   ... и еще ${events.length - 5} событий с такой же ошибкой\n`);
      }
    }

    // Статистика по типам событий с ошибками
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Статистика по типам событий с ошибками:\n');
    
    const byEventType = await sql`
      SELECT 
        event_name,
        type,
        COUNT(*) as count,
        array_agg(DISTINCT reason) as reasons
      FROM events
      WHERE processed = true AND ok = false
      GROUP BY event_name, type
      ORDER BY count DESC
    `;

    for (const stat of byEventType) {
      console.log(`   ${stat.event_name || stat.type || 'unknown'}: ${stat.count} ошибок`);
      if (stat.reasons && stat.reasons.length > 0) {
        const uniqueReasons = [...new Set(stat.reasons)].slice(0, 3);
        console.log(`      Причины: ${uniqueReasons.join('; ')}`);
      }
    }

    // Проверяем конкретные проблемные события из терминала
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 Проверка конкретных проблемных событий:\n');
    
    const problemIds = [1844, 1848, 1860, 1863];
    
    for (const eventId of problemIds) {
      const event = await sql`
        SELECT 
          id, ts, event_name, type, rentprog_id, ext_id, company_id, 
          reason, payload, metadata, processed, ok
        FROM events
        WHERE id = ${eventId}
      `;

      if (event.length > 0) {
        const e = event[0];
        console.log(`\n   Событие ${e.id}:`);
        console.log(`      Время: ${e.ts.toISOString()}`);
        console.log(`      Тип: ${e.event_name || e.type}`);
        console.log(`      RentProg ID: ${e.rentprog_id || e.ext_id || 'null'}`);
        console.log(`      Company ID: ${e.company_id || 'null'}`);
        console.log(`      Обработано: ${e.processed ? '✅' : '❌'}`);
        console.log(`      Успешно: ${e.ok ? '✅' : '❌'}`);
        console.log(`      Ошибка: ${e.reason || 'нет'}`);
        
        if (e.payload) {
          const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
          console.log(`      Payload keys: ${Object.keys(payload).join(', ')}`);
          
          // Проверяем на проблемные поля
          for (const [key, value] of Object.entries(payload)) {
            if (Array.isArray(value)) {
              console.log(`      ⚠️  ${key} = массив: [${value.join(', ')}]`);
            }
            if (value instanceof Date) {
              console.log(`      ⚠️  ${key} = Date объект`);
            }
          }
        }
      } else {
        console.log(`\n   Событие ${eventId}: не найдено`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Анализ завершен\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkErrors().catch(console.error);

