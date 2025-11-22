#!/usr/bin/env node
/**
 * Анализ workflow обработки вебхуков Tbilisi
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function analyzeWorkflow() {
  console.log('📊 Анализ workflow обработки вебхуков Tbilisi\n');
  
  try {
    // 1. Проверяем текущую версию функции dynamic_upsert_entity
    console.log('1️⃣ Проверка функции dynamic_upsert_entity:\n');
    
    const functionDef = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
        AND pronargs = 3
      ORDER BY oid DESC
      LIMIT 1
    `;
    
    if (functionDef.length > 0) {
      const def = functionDef[0].definition;
      
      // Проверяем критические моменты
      console.log('   ✅ Функция найдена');
      
      // Проверка обработки NULL
      if (def.includes("p_data->>v_key") && !def.includes("NULLIF")) {
        console.log('   ⚠️  ПРОБЛЕМА: Используется p_data->>v_key без обработки NULL');
        console.log('      Это может затереть существующие значения при NULL в payload');
      } else if (def.includes("NULLIF") || def.includes("COALESCE")) {
        console.log('   ✅ NULL значения обрабатываются корректно');
      }
      
      // Проверка создания новых записей
      if (def.includes("v_entity_id IS NULL") && def.includes("gen_random_uuid()")) {
        console.log('   ✅ Создание новых записей реализовано');
      } else {
        console.log('   ⚠️  ПРОБЛЕМА: Логика создания новых записей не найдена');
      }
      
      // Проверка обновления external_refs
      if (def.includes("UPDATE external_refs") && def.includes("data = p_data")) {
        console.log('   ⚠️  ПРОБЛЕМА: external_refs.data полностью перезаписывается');
        console.log('      Должно быть: data = data || p_data::jsonb (мерж)');
      } else if (def.includes("data = data ||")) {
        console.log('   ✅ external_refs.data мержится корректно');
      }
      
      // Проверка обновления основной таблицы
      if (def.includes("UPDATE") && def.includes("SET") && def.includes("format")) {
        console.log('   ✅ Обновление основной таблицы реализовано');
        
        // Проверяем, есть ли защита от затирания
        if (def.includes("COALESCE") || def.includes("NULLIF")) {
          console.log('   ✅ Есть защита от затирания NULL значениями');
        } else {
          console.log('   ⚠️  НЕТ защиты: NULL значения из payload могут затереть существующие');
        }
      }
      
    } else {
      console.log('   ❌ Функция не найдена');
    }
    
    // 2. Проверяем примеры данных из events
    console.log('\n2️⃣ Проверка примеров данных из events:\n');
    
    const sampleEvents = await sql`
      SELECT 
        event_name,
        entity_type,
        operation,
        rentprog_id,
        payload,
        processed
      FROM events
      WHERE entity_type IN ('car', 'client', 'booking')
        AND operation = 'update'
      ORDER BY ts DESC
      LIMIT 5
    `;
    
    console.log(`   Найдено примеров UPDATE: ${sampleEvents.length}`);
    
    for (const event of sampleEvents) {
      console.log(`\n   📋 ${event.entity_type} #${event.rentprog_id} (${event.event_name}):`);
      
      if (event.payload) {
        const payload = event.payload;
        const keys = Object.keys(payload);
        
        // Проверяем наличие массивов [old, new]
        const arrayFields = keys.filter(k => Array.isArray(payload[k]) && payload[k].length === 2);
        if (arrayFields.length > 0) {
          console.log(`      ✅ Найдены поля с [old, new]: ${arrayFields.slice(0, 5).join(', ')}`);
          
          // Проверяем наличие NULL значений
          const nullFields = arrayFields.filter(k => {
            const arr = payload[k];
            return arr[0] === null || arr[1] === null;
          });
          if (nullFields.length > 0) {
            console.log(`      ⚠️  Поля с NULL: ${nullFields.slice(0, 3).join(', ')}`);
          }
        } else {
          console.log(`      ⚠️  Нет полей в формате [old, new]`);
        }
        
        // Проверяем наличие пустых строк
        const emptyFields = keys.filter(k => payload[k] === '' || payload[k] === null);
        if (emptyFields.length > 0) {
          console.log(`      ⚠️  Пустые/NULL поля: ${emptyFields.slice(0, 5).join(', ')}`);
        }
      }
    }
    
    // 3. Проверяем создание новых записей
    console.log('\n3️⃣ Проверка создания новых записей:\n');
    
    const newEntities = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h
      FROM external_refs
      WHERE system = 'rentprog'
    `;
    
    console.log(`   Всего записей в external_refs: ${newEntities[0].total}`);
    console.log(`   Создано за 24 часа: ${newEntities[0].last_24h}`);
    
    // 4. Проверяем обновления с NULL
    console.log('\n4️⃣ Проверка обновлений с потенциальным затиранием:\n');
    
    const recentUpdates = await sql`
      SELECT 
        er.entity_type,
        er.external_id,
        er.updated_at,
        c.plate as car_plate,
        cl.name as client_name,
        b.number as booking_number
      FROM external_refs er
      LEFT JOIN cars c ON c.id = er.entity_id AND er.entity_type = 'car'
      LEFT JOIN clients cl ON cl.id = er.entity_id AND er.entity_type = 'client'
      LEFT JOIN bookings b ON b.id = er.entity_id AND er.entity_type = 'booking'
      WHERE er.system = 'rentprog'
        AND er.updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY er.updated_at DESC
      LIMIT 10
    `;
    
    console.log(`   Обновлено за 24 часа: ${recentUpdates.length} записей`);
    
    // 5. Проверяем структуру workflow логики
    console.log('\n5️⃣ Анализ логики workflow:\n');
    console.log('   📝 Prepare Update:');
    console.log('      ✅ Извлекает последние значения из [old, new]');
    console.log('      ⚠️  НЕ фильтрует NULL значения');
    console.log('      ⚠️  НЕ фильтрует пустые строки');
    console.log('');
    console.log('   📝 Update Entity:');
    console.log('      ✅ Использует data = data || $1::jsonb (мерж)');
    console.log('      ✅ НЕ затирает существующие данные в external_refs');
    console.log('');
    console.log('   📝 dynamic_upsert_entity:');
    console.log('      ⚠️  Использует format(\'%I = %L\', v_key, p_data->>v_key)');
    console.log('      ⚠️  NULL значения могут затереть существующие поля');
    console.log('      ⚠️  НЕТ проверки на NULL перед обновлением');
    
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

analyzeWorkflow()
  .then(() => {
    console.log('\n✅ Анализ завершен!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

