#!/usr/bin/env node

/**
 * Reprocess unprocessed history operations for bookings
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const missingIds = [
  '514378', '513772', '511419', '515201', '514480', '514303',
  '514030', '513985', '513928', '512915', '512491', '511974', '511520'
];

async function reprocess() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔄 Повторная обработка необработанных операций по броням...\n');

    // Найти необработанные операции
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
      LIMIT 100
    `;

    console.log(`Найдено необработанных операций: ${unprocessed.length}\n`);

    if (unprocessed.length === 0) {
      console.log('✅ Все операции уже обработаны');
      return;
    }

    // Обновить processed = FALSE, чтобы триггер сработал снова
    // Но сначала нужно убедиться, что external_refs есть
    let reprocessed = 0;
    let errors = 0;

    for (const op of unprocessed) {
      try {
        // Проверить наличие external_refs
        const ref = await sql`
          SELECT entity_id
          FROM external_refs
          WHERE system = 'rentprog'
            AND entity_type = 'booking'
            AND external_id = ${op.entity_id}
          LIMIT 1
        `;

        if (ref.length === 0) {
          console.log(`⚠️ Бронь #${op.entity_id}: external_refs отсутствует, пропускаем`);
          continue;
        }

        // Обновить processed = FALSE, чтобы триггер сработал
        await sql`
          UPDATE history
          SET processed = FALSE,
              error_code = NULL
          WHERE id = ${op.id}
        `;

        // Вызвать функцию apply_history_changes вручную
        const rawData = op.raw_data || {};
        const result = await sql`
          SELECT apply_history_changes(
            ${op.id},
            ${op.entity_type},
            ${op.entity_id},
            ${op.operation_type || 'unknown'},
            ${op.branch},
            ${op.user_name},
            ${rawData}::jsonb,
            ${op.description},
            NULL::text,
            NULL::text,
            '{}'::jsonb
          ) as applied
        `;

        if (result[0].applied) {
          reprocessed++;
          console.log(`✅ Обработана операция #${op.operation_id} для брони #${op.entity_id}`);
        } else {
          errors++;
          console.log(`❌ Не удалось обработать операцию #${op.operation_id} для брони #${op.entity_id}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Ошибка при обработке операции #${op.operation_id}:`, error.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 РЕЗУЛЬТАТ:\n');
    console.log(`Обработано: ${reprocessed}`);
    console.log(`Ошибок: ${errors}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

reprocess().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

