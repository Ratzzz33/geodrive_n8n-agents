#!/usr/bin/env node

/**
 * Check unprocessed history operations for bookings
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function check() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка необработанных операций по броням...\n');

    // Проверяем необработанные операции
    const unprocessed = await sql`
      SELECT 
        id,
        branch,
        operation_type,
        operation_id,
        description,
        entity_type,
        entity_id,
        user_name,
        created_at,
        processed,
        error_code,
        raw_data
      FROM history
      WHERE entity_type = 'booking'
        AND entity_id = ANY(${missingIds})
        AND processed = FALSE
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log(`Найдено необработанных операций: ${unprocessed.length}\n`);

    if (unprocessed.length > 0) {
      // Группируем по броням
      const byBooking = {};
      unprocessed.forEach(op => {
        const bookingId = op.entity_id;
        if (!byBooking[bookingId]) {
          byBooking[bookingId] = [];
        }
        byBooking[bookingId].push(op);
      });

      // Проверяем, есть ли брони в таблице bookings
      const bookingIds = Object.keys(byBooking);
      const bookingsInDb = await sql`
        SELECT 
          b.id,
          b.rentprog_id,
          er.external_id as rentprog_id_from_ref
        FROM bookings b
        LEFT JOIN external_refs er ON er.entity_type = 'booking' 
          AND er.entity_id = b.id 
          AND er.system = 'rentprog'
        WHERE er.external_id = ANY(${bookingIds})
           OR b.rentprog_id::text = ANY(${bookingIds})
      `;

      const foundBookingIds = new Set();
      bookingsInDb.forEach(b => {
        if (b.rentprog_id_from_ref) foundBookingIds.add(b.rentprog_id_from_ref);
        if (b.rentprog_id) foundBookingIds.add(String(b.rentprog_id));
      });

      console.log(`Броней в таблице bookings: ${bookingsInDb.length}`);
      console.log(`Найдено ID: ${Array.from(foundBookingIds).join(', ')}\n`);

      Object.entries(byBooking).forEach(([bookingId, ops]) => {
        const hasBooking = foundBookingIds.has(bookingId);
        console.log(`📋 Бронь #${bookingId}: ${ops.length} необработанных операций`);
        console.log(`   Бронь в БД: ${hasBooking ? '✅' : '❌'}`);
        
        if (!hasBooking) {
          console.log(`   ❌ ПРОБЛЕМА: Бронь отсутствует в таблице bookings`);
          console.log(`   💡 Решение: Нужно создать бронь через handleRentProgEvent`);
        } else {
          console.log(`   ⚠️ Бронь есть, но операции не обработаны`);
          console.log(`   💡 Возможная причина: Ошибка в apply_history_changes()`);
        }
        
        // Показываем первую операцию для примера
        const firstOp = ops[0];
        console.log(`   Первая операция:`);
        console.log(`     operation_id: ${firstOp.operation_id}`);
        console.log(`     description: ${firstOp.description?.substring(0, 80) || 'N/A'}...`);
        console.log(`     error_code: ${firstOp.error_code || 'NULL'}`);
        console.log(`     created_at: ${firstOp.created_at ? new Date(firstOp.created_at).toISOString() : 'NULL'}`);
        console.log('');
      });

      // Проверяем, есть ли операции с ошибками
      const withErrors = unprocessed.filter(op => op.error_code);
      if (withErrors.length > 0) {
        console.log(`\n❌ Операций с ошибками: ${withErrors.length}`);
        const errorTypes = {};
        withErrors.forEach(op => {
          const err = op.error_code || 'unknown';
          if (!errorTypes[err]) errorTypes[err] = 0;
          errorTypes[err]++;
        });
        Object.entries(errorTypes).forEach(([err, count]) => {
          console.log(`   ${err}: ${count}`);
        });
      }
    } else {
      console.log('✅ Все операции обработаны');
    }

    // Проверяем структуру raw_data для понимания, что там есть
    const sampleOp = unprocessed[0];
    if (sampleOp && sampleOp.raw_data) {
      console.log('\n📋 Пример raw_data:');
      try {
        const rawData = typeof sampleOp.raw_data === 'string' 
          ? JSON.parse(sampleOp.raw_data) 
          : sampleOp.raw_data;
        console.log(JSON.stringify(rawData, null, 2).substring(0, 500));
      } catch (e) {
        console.log('Ошибка парсинга raw_data:', e.message);
      }
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

