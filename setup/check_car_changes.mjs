#!/usr/bin/env node
/**
 * Проверка изменений машины по rentprog_id
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function checkCarChanges(rentprogId, date) {
  console.log(`🔍 Поиск изменений машины ${rentprogId} за ${date}\n`);
  
  try {
    // 1. Находим машину по rentprog_id
    const car = await sql`
      SELECT 
        c.id,
        c.plate,
        c.model,
        c.rentprog_id,
        c.updated_at,
        c.updated_by_source,
        c.updated_by_user,
        c.updated_by_workflow,
        c.updated_by_function,
        c.updated_by_execution_id,
        c.updated_by_metadata
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
    console.log(`📋 Информация о машине:`);
    console.log(`   ID: ${carData.id}`);
    console.log(`   Госномер: ${carData.plate || 'не указан'}`);
    console.log(`   Модель: ${carData.model || 'не указана'}`);
    console.log(`   RentProg ID: ${carData.rentprog_id || rentprogId}`);
    console.log(`   Последнее обновление: ${carData.updated_at}`);
    console.log(`   Источник последнего изменения: ${carData.updated_by_source || 'не указан'}`);
    console.log(`   Автор последнего изменения: ${carData.updated_by_user || 'не указан'}`);
    console.log(`   Функция: ${carData.updated_by_function || 'не указана'}`);
    console.log('');
    
    // 2. Ищем все изменения этой машины за указанную дату
    const targetDate = date || '2025-01-21';
    console.log(`📅 Поиск изменений за ${targetDate}...\n`);
    
    // Изменения через history
    const historyChanges = await sql`
      SELECT 
        h.id,
        h.ts,
        h.created_at,
        h.description,
        h.user_name,
        h.operation_type,
        h.entity_type,
        h.entity_id,
        h.raw_data,
        c.updated_at as car_updated_at,
        c.updated_by_source,
        c.updated_by_user,
        c.updated_by_metadata
      FROM history h
      INNER JOIN external_refs er ON er.external_id = h.entity_id::TEXT
      INNER JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.external_id = ${rentprogId}
        AND er.entity_type = 'car'
        AND DATE(h.created_at) = ${targetDate}::DATE
        AND h.entity_type = 'car'
      ORDER BY h.created_at ASC
    `;
    
    console.log(`📜 Изменения через history (${historyChanges.length}):`);
    if (historyChanges.length > 0) {
      for (const change of historyChanges) {
        console.log(`\n   [${change.created_at.toISOString()}]`);
        console.log(`   Автор: ${change.user_name || 'не указан'}`);
        console.log(`   Описание: ${change.description || 'нет описания'}`);
        console.log(`   Тип операции: ${change.operation_type || 'не указан'}`);
        if (change.car_updated_at) {
          console.log(`   Обновлено в cars: ${change.car_updated_at}`);
          console.log(`   Источник: ${change.updated_by_source || 'не указан'}`);
          console.log(`   Автор в cars: ${change.updated_by_user || 'не указан'}`);
        }
        if (change.raw_data) {
          console.log(`   Данные: ${JSON.stringify(change.raw_data).substring(0, 200)}...`);
        }
      }
    } else {
      console.log(`   Нет изменений через history`);
    }
    
    // 3. Ищем изменения через events (webhooks)
    const eventChanges = await sql`
      SELECT 
        e.id,
        e.ts,
        e.event_name,
        e.type,
        e.operation,
        e.entity_type,
        e.payload,
        e.metadata,
        c.updated_at as car_updated_at,
        c.updated_by_source,
        c.updated_by_workflow,
        c.updated_by_execution_id
      FROM events e
      INNER JOIN external_refs er ON er.external_id = e.ext_id::TEXT OR er.external_id = e.rentprog_id::TEXT
      INNER JOIN cars c ON c.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND (er.external_id = e.ext_id::TEXT OR er.external_id = e.rentprog_id::TEXT)
        AND er.entity_type = 'car'
        AND er.external_id = ${rentprogId}
        AND DATE(e.ts) = ${targetDate}::DATE
      ORDER BY e.ts ASC
    `;
    
    console.log(`\n\n🔔 Изменения через events/webhooks (${eventChanges.length}):`);
    if (eventChanges.length > 0) {
      for (const event of eventChanges) {
        console.log(`\n   [${event.ts.toISOString()}]`);
        console.log(`   Событие: ${event.event_name || event.type || 'не указано'}`);
        console.log(`   Операция: ${event.operation || 'не указана'}`);
        if (event.car_updated_at) {
          console.log(`   Обновлено в cars: ${event.car_updated_at}`);
          console.log(`   Источник: ${event.updated_by_source || 'не указан'}`);
          console.log(`   Workflow: ${event.updated_by_workflow || 'не указан'}`);
          console.log(`   Execution ID: ${event.updated_by_execution_id || 'не указан'}`);
        }
        if (event.payload) {
          console.log(`   Данные: ${JSON.stringify(event.payload).substring(0, 200)}...`);
        }
      }
    } else {
      console.log(`   Нет изменений через events`);
    }
    
    // 4. Ищем все изменения в таблице cars за эту дату
    const carUpdates = await sql`
      SELECT 
        c.updated_at,
        c.updated_by_source,
        c.updated_by_user,
        c.updated_by_workflow,
        c.updated_by_function,
        c.updated_by_execution_id,
        c.updated_by_metadata
      FROM cars c
      WHERE c.id = ${carData.id}
        AND DATE(c.updated_at) = ${targetDate}::DATE
      ORDER BY c.updated_at ASC
    `;
    
    console.log(`\n\n🚗 Прямые обновления в таблице cars (${carUpdates.length}):`);
    if (carUpdates.length > 0) {
      for (const update of carUpdates) {
        console.log(`\n   [${update.updated_at.toISOString()}]`);
        console.log(`   Источник: ${update.updated_by_source || 'не указан'}`);
        console.log(`   Автор: ${update.updated_by_user || 'не указан'}`);
        console.log(`   Workflow: ${update.updated_by_workflow || 'не указан'}`);
        console.log(`   Функция: ${update.updated_by_function || 'не указана'}`);
        console.log(`   Execution ID: ${update.updated_by_execution_id || 'не указан'}`);
        if (update.updated_by_metadata) {
          console.log(`   Метаданные: ${JSON.stringify(update.updated_by_metadata)}`);
        }
      }
    } else {
      console.log(`   Нет прямых обновлений за эту дату`);
    }
    
    // 5. Сводка по авторам
    console.log(`\n\n👥 Сводка по авторам изменений:`);
    const authors = await sql`
      SELECT 
        c.updated_by_user,
        COUNT(*) as count,
        MIN(c.updated_at) as first_change,
        MAX(c.updated_at) as last_change
      FROM cars c
      WHERE c.id = ${carData.id}
        AND DATE(c.updated_at) = ${targetDate}::DATE
        AND c.updated_by_user IS NOT NULL
      GROUP BY c.updated_by_user
      ORDER BY count DESC
    `;
    
    if (authors.length > 0) {
      for (const author of authors) {
        console.log(`   ${author.updated_by_user}: ${author.count} изменений`);
        console.log(`      Первое: ${author.first_change}`);
        console.log(`      Последнее: ${author.last_change}`);
      }
    } else {
      console.log(`   Нет информации об авторах (изменения через триггеры/webhooks без автора)`);
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

// Получаем параметры из командной строки
const rentprogId = process.argv[2] || '48581';
const date = process.argv[3] || '2025-01-21';

checkCarChanges(rentprogId, date)
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

