#!/usr/bin/env node

/**
 * Check history table for booking operations
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
    console.log('🔍 Проверка таблицы history для отсутствующих броней...\n');

    // Ищем операции по броням в history
    const operations = await sql`
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
        error_code
      FROM history
      WHERE entity_type = 'booking'
        AND entity_id = ANY(${missingIds})
      ORDER BY created_at DESC
      LIMIT 100
    `;

    console.log(`Найдено операций в history: ${operations.length}\n`);

    if (operations.length > 0) {
      const byBooking = {};
      operations.forEach(op => {
        const bookingId = op.entity_id;
        if (!byBooking[bookingId]) {
          byBooking[bookingId] = [];
        }
        byBooking[bookingId].push(op);
      });

      Object.entries(byBooking).forEach(([bookingId, ops]) => {
        console.log(`📋 Бронь #${bookingId}: ${ops.length} операций`);
        ops.forEach((op, idx) => {
          console.log(`   [${idx + 1}] ${op.operation_type || 'unknown'} | ${op.description?.substring(0, 80) || 'N/A'}...`);
          console.log(`      operation_id: ${op.operation_id || 'NULL'}`);
          console.log(`      processed: ${op.processed ? '✅' : '❌'}`);
          console.log(`      error_code: ${op.error_code || 'NULL'}`);
          console.log(`      created_at: ${op.created_at ? new Date(op.created_at).toISOString() : 'NULL'}`);
        });
        console.log('');
      });
    } else {
      console.log('❌ Операции по этим броням НЕ найдены в history');
    }

    // Проверяем, есть ли операции в history_audit
    const auditOps = await sql`
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
        error_code
      FROM history_audit
      WHERE entity_type = 'booking'
        AND entity_id = ANY(${missingIds})
      ORDER BY created_at DESC
      LIMIT 100
    `;

    console.log(`\n📝 Найдено операций в history_audit: ${auditOps.length}`);

    // Ищем операции по описанию (может быть entity_id не заполнен)
    const opsByDescription = await sql`
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
        error_code
      FROM history
      WHERE description LIKE ANY(${missingIds.map(id => `%${id}%`)})
      ORDER BY created_at DESC
      LIMIT 50
    `;

    if (opsByDescription.length > 0) {
      console.log(`\n📋 Найдено операций по описанию: ${opsByDescription.length}`);
      const byBooking = {};
      opsByDescription.forEach(op => {
        // Извлекаем номер брони из описания
        const match = op.description?.match(/бронь № (\d+)/i);
        if (match) {
          const bookingId = match[1];
          if (missingIds.includes(bookingId)) {
            if (!byBooking[bookingId]) {
              byBooking[bookingId] = [];
            }
            byBooking[bookingId].push(op);
          }
        }
      });

      if (Object.keys(byBooking).length > 0) {
        console.log('\nОперации по отсутствующим броням (найдены по описанию):');
        Object.entries(byBooking).forEach(([bookingId, ops]) => {
          console.log(`\n📋 Бронь #${bookingId}: ${ops.length} операций`);
          ops.forEach((op, idx) => {
            console.log(`   [${idx + 1}] ${op.operation_type || 'unknown'} | ${op.description?.substring(0, 80) || 'N/A'}...`);
            console.log(`      operation_id: ${op.operation_id || 'NULL'}`);
            console.log(`      entity_id: ${op.entity_id || 'NULL'} (должен быть ${bookingId})`);
            console.log(`      processed: ${op.processed ? '✅' : '❌'}`);
            console.log(`      error_code: ${op.error_code || 'NULL'}`);
          });
        });
      }
    }

    // Итоговый вывод
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ИТОГОВЫЙ ВЫВОД:\n');

    const foundInHistory = new Set();
    operations.forEach(op => foundInHistory.add(op.entity_id));
    opsByDescription.forEach(op => {
      const match = op.description?.match(/бронь № (\d+)/i);
      if (match && missingIds.includes(match[1])) {
        foundInHistory.add(match[1]);
      }
    });

    const foundCount = foundInHistory.size;
    const notFoundCount = missingIds.length - foundCount;

    console.log(`Найдено в history: ${foundCount} из ${missingIds.length}`);
    console.log(`НЕ найдено: ${notFoundCount}`);

    if (notFoundCount > 0) {
      const notFound = missingIds.filter(id => !foundInHistory.has(id));
      console.log('\n❌ Брони без операций в history:');
      notFound.forEach(id => {
        console.log(`   - #${id}`);
      });
      console.log('\n💡 Возможные причины:');
      console.log('   1. Операции по этим броням не попали в API ответ');
      console.log('   2. Операции были в более старых страницах (не попали в первые 100)');
      console.log('   3. Операции не были сохранены в history');
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

