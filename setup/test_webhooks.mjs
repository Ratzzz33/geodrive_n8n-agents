#!/usr/bin/env node
/**
 * Тестирование исправленного workflow на последних вебхуках
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function testWebhooks() {
  console.log('🔍 Поиск последних вебхуков для тестирования...\n');
  
  try {
    // Ищем последние UPDATE события с NULL значениями
    const testEvents = await sql`
      SELECT 
        e.id,
        e.event_name,
        e.entity_type,
        e.operation,
        e.rentprog_id,
        e.payload,
        e.ts,
        e.processed
      FROM events e
      WHERE e.entity_type IN ('car', 'client', 'booking')
        AND e.operation = 'update'
        AND e.company_id = 11158
        AND e.ts > NOW() - INTERVAL '7 days'
      ORDER BY e.ts DESC
      LIMIT 5
    `;
    
    console.log(`Найдено событий для тестирования: ${testEvents.length}\n`);
    
    for (const event of testEvents) {
      console.log(`📋 ${event.entity_type} #${event.rentprog_id} (${event.event_name}):`);
      console.log(`   Время: ${event.ts}`);
      console.log(`   Обработано: ${event.processed ? 'да' : 'нет'}`);
      
      if (event.payload) {
        const payload = event.payload;
        const keys = Object.keys(payload);
        
        // Проверяем наличие NULL значений
        const nullFields = [];
        for (const key of keys) {
          const value = payload[key];
          if (Array.isArray(value) && value.length === 2) {
            if (value[0] === null || value[1] === null) {
              nullFields.push({ key, old: value[0], new: value[1] });
            }
          } else if (value === null) {
            nullFields.push({ key, value: null });
          }
        }
        
        if (nullFields.length > 0) {
          console.log(`   ⚠️  Найдены NULL значения:`);
          for (const field of nullFields.slice(0, 5)) {
            console.log(`      - ${field.key}: ${JSON.stringify(field.old)} → ${JSON.stringify(field.new || field.value)}`);
          }
        } else {
          console.log(`   ✅ NULL значений не найдено`);
        }
      }
      
      console.log('');
    }
    
    // Проверяем текущее состояние данных для одного из событий
    if (testEvents.length > 0) {
      const testEvent = testEvents[0];
      console.log(`\n🔍 Проверяю текущее состояние данных для ${testEvent.entity_type} #${testEvent.rentprog_id}...\n`);
      
      // Находим entity_id
      const entityRef = await sql`
        SELECT entity_id
        FROM external_refs
        WHERE system = 'rentprog'
          AND external_id = ${testEvent.rentprog_id}
        LIMIT 1
      `;
      
      if (entityRef.length > 0) {
        const entityId = entityRef[0].entity_id;
        console.log(`   Entity ID: ${entityId}`);
        
        // Получаем данные из основной таблицы
        let tableData;
        if (testEvent.entity_type === 'car') {
          tableData = await sql`
            SELECT plate, model, state, active
            FROM cars
            WHERE id = ${entityId}
          `;
        } else if (testEvent.entity_type === 'client') {
          tableData = await sql`
            SELECT name, lastname, phone, email
            FROM clients
            WHERE id = ${entityId}
          `;
        } else if (testEvent.entity_type === 'booking') {
          tableData = await sql`
            SELECT number, state, active, price
            FROM bookings
            WHERE id = ${entityId}
          `;
        }
        
        if (tableData && tableData.length > 0) {
          console.log(`   Текущие данные в БД:`);
          console.log(`   ${JSON.stringify(tableData[0], null, 2)}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    await sql.end();
  }
}

testWebhooks()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

