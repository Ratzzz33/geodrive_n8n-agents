#!/usr/bin/env node
/**
 * Проверка всех изменений машины по rentprog_id
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkAllCarChanges(rentprogId) {
  console.log(`🔍 Все изменения машины ${rentprogId}\n`);
  
  try {
    // 1. Находим машину
    const car = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.rentprog_id,
        c.created_at,
        c.updated_at
      FROM cars c
      INNER JOIN external_refs er ON c.id = er.entity_id
      WHERE er.system = 'rentprog' 
        AND er.external_id = ${rentprogId}
        AND er.entity_type = 'car'
      LIMIT 1
    `;
    
    if (car.length === 0) {
      console.log(`❌ Машина с rentprog_id ${rentprogId} не найдена в БД`);
      return;
    }
    
    const carData = car[0];
    console.log(`📋 Машина: ${carData.plate || 'не указан'} - ${carData.model || 'не указана'}`);
    console.log(`   Создана: ${carData.created_at}`);
    console.log(`   Обновлена: ${carData.updated_at}\n`);
    
    // 2. Все изменения через history
    const historyChanges = await sql`
      SELECT 
        h.id,
        h.ts,
        h.created_at,
        h.description,
        h.user_name,
        h.operation_type,
        h.branch,
        h.raw_data
      FROM history h
      WHERE h.entity_type = 'car'
        AND h.entity_id = ${rentprogId}
      ORDER BY h.created_at DESC
      LIMIT 50
    `;
    
    console.log(`📜 История изменений (последние ${historyChanges.length}):`);
    for (const change of historyChanges) {
      const date = change.created_at.toISOString().split('T')[0];
      const time = change.created_at.toTimeString().split(' ')[0];
      console.log(`\n   [${date} ${time}]`);
      console.log(`   👤 ${change.user_name || 'не указан'}`);
      console.log(`   📝 ${change.description || 'нет описания'}`);
      console.log(`   🏢 Филиал: ${change.branch || 'не указан'}`);
      console.log(`   🔧 Тип: ${change.operation_type || 'не указан'}`);
    }
    
    // 3. Все изменения через events
    const eventChanges = await sql`
      SELECT 
        e.id,
        e.ts,
        e.event_name,
        e.type,
        e.operation,
        e.branch,
        e.payload
      FROM events e
      WHERE (e.ext_id = ${rentprogId} OR e.rentprog_id = ${rentprogId})
        AND e.entity_type = 'car'
      ORDER BY e.ts DESC
      LIMIT 50
    `;
    
    console.log(`\n\n🔔 События/webhooks (последние ${eventChanges.length}):`);
    for (const event of eventChanges) {
      const date = event.ts.toISOString().split('T')[0];
      const time = event.ts.toTimeString().split(' ')[0];
      console.log(`\n   [${date} ${time}]`);
      console.log(`   📢 ${event.event_name || event.type || 'не указано'}`);
      console.log(`   🔧 ${event.operation || 'не указана'}`);
      console.log(`   🏢 Филиал: ${event.branch || 'не указан'}`);
    }
    
    // 4. Сводка по авторам из history
    console.log(`\n\n👥 Сводка по авторам (из history):`);
    const authors = await sql`
      SELECT 
        h.user_name,
        COUNT(*) as count,
        MIN(h.created_at) as first_change,
        MAX(h.created_at) as last_change,
        array_agg(DISTINCT h.operation_type) as operations
      FROM history h
      WHERE h.entity_type = 'car'
        AND h.entity_id = ${rentprogId}
        AND h.user_name IS NOT NULL
      GROUP BY h.user_name
      ORDER BY count DESC
    `;
    
    if (authors.length > 0) {
      for (const author of authors) {
        console.log(`\n   ${author.user_name}:`);
        console.log(`      Изменений: ${author.count}`);
        console.log(`      Первое: ${author.first_change}`);
        console.log(`      Последнее: ${author.last_change}`);
        console.log(`      Операции: ${author.operations.join(', ')}`);
      }
    } else {
      console.log(`   Нет информации об авторах`);
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

const rentprogId = process.argv[2] || '48581';

checkAllCarChanges(rentprogId)
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

