#!/usr/bin/env node

/**
 * Check why bookings from execution were not saved to DB
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Брони, которые были в execution
const executionBookings = ['515042', '515008', '514944', '514378', '513772', '511419'];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка почему брони из execution не сохранились...\n');

    // 1. Проверить, есть ли эти брони в таблице bookings (через rentprog_id)
    console.log('1️⃣ Проверка в таблице bookings:\n');
    const bookingsInDB = await sql`
      SELECT 
        rentprog_id,
        number,
        status,
        start_at,
        end_at,
        created_at
      FROM bookings
      WHERE rentprog_id = ANY(${executionBookings})
      ORDER BY rentprog_id::INTEGER DESC
    `;

    if (bookingsInDB.length > 0) {
      console.log(`✅ Найдено в bookings: ${bookingsInDB.length}`);
      bookingsInDB.forEach(b => {
        console.log(`   - #${b.rentprog_id} | Статус: ${b.status || 'NULL'} | Создана: ${b.created_at ? new Date(b.created_at).toISOString() : 'NULL'}`);
      });
    } else {
      console.log('❌ Брони НЕ найдены в таблице bookings');
    }

    // 2. Проверить external_refs
    console.log('\n2️⃣ Проверка external_refs:\n');
    const refs = await sql`
      SELECT 
        er.external_id as rentprog_booking_id,
        er.entity_id as booking_id,
        b.status
      FROM external_refs er
      LEFT JOIN bookings b ON b.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id = ANY(${executionBookings})
      ORDER BY er.external_id::INTEGER DESC
    `;

    if (refs.length > 0) {
      console.log(`✅ Найдено в external_refs: ${refs.length}`);
      refs.forEach(r => {
        console.log(`   - #${r.rentprog_booking_id} | Booking ID: ${r.booking_id} | Статус: ${r.status || 'NULL'}`);
      });
    } else {
      console.log('❌ Брони НЕ найдены в external_refs');
    }

    // 3. Проверить структуру таблицы bookings
    console.log('\n3️⃣ Проверка структуры таблицы bookings:\n');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bookings'
        AND column_name IN ('rentprog_id', 'id', 'number', 'status', 'start_at', 'end_at')
      ORDER BY column_name
    `;

    console.log('Колонки в таблице bookings:');
    columns.forEach(c => {
      console.log(`   - ${c.column_name}: ${c.data_type}`);
    });

    // 4. Проверить, есть ли колонка rentprog_id
    const hasRentprogId = columns.some(c => c.column_name === 'rentprog_id');
    if (!hasRentprogId) {
      console.log('\n⚠️ ВНИМАНИЕ: Колонка rentprog_id отсутствует в таблице bookings!');
      console.log('   Workflow пытается сохранить в rentprog_id, но колонки нет');
      console.log('   Брони должны сохраняться через external_refs, а не напрямую в bookings');
    }

    // 5. Проверить последние сохраненные брони
    console.log('\n4️⃣ Последние сохраненные брони (для сравнения):\n');
    const recentBookings = await sql`
      SELECT 
        er.external_id as rentprog_booking_id,
        b.id,
        b.status,
        b.created_at
      FROM external_refs er
      JOIN bookings b ON b.id = er.entity_id
      WHERE er.system = 'rentprog'
        AND er.entity_type = 'booking'
        AND er.external_id::INTEGER >= 515000
      ORDER BY er.external_id::INTEGER DESC
      LIMIT 10
    `;

    if (recentBookings.length > 0) {
      console.log('Последние сохраненные брони (515xxx):');
      recentBookings.forEach(b => {
        console.log(`   - #${b.rentprog_booking_id} | Статус: ${b.status || 'NULL'} | Создана: ${b.created_at ? new Date(b.created_at).toISOString() : 'NULL'}`);
      });
    } else {
      console.log('❌ Нет броней 515xxx в БД');
    }

    // Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');

    if (!hasRentprogId) {
      console.log('❌ ПРОБЛЕМА: Workflow пытается сохранить в несуществующую колонку');
      console.log('\nПричина:');
      console.log('   - Workflow использует upsert с matchingColumns: ["rentprog_id"]');
      console.log('   - Но в таблице bookings нет колонки rentprog_id');
      console.log('   - Брони должны сохраняться через external_refs');
      console.log('\n💡 Решение:');
      console.log('   1. Изменить workflow, чтобы он сохранял через external_refs');
      console.log('   2. Или добавить колонку rentprog_id в таблицу bookings');
      console.log('   3. Или использовать правильный upsert через external_refs');
    } else if (bookingsInDB.length === 0 && refs.length === 0) {
      console.log('❌ ПРОБЛЕМА: Брони не сохранились');
      console.log('\nВозможные причины:');
      console.log('   1. Ошибка при upsert в ноде "Save to DB"');
      console.log('   2. Ошибка при создании external_refs');
      console.log('   3. Проблема с данными (NULL значения в обязательных полях)');
    } else if (bookingsInDB.length > 0 && refs.length === 0) {
      console.log('⚠️ Брони есть в bookings, но нет external_refs');
      console.log('   Это означает, что брони созданы, но не связаны с RentProg');
    } else {
      console.log('✅ Брони сохранены корректно');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

check().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

