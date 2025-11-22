#!/usr/bin/env node

/**
 * Check statistics for last workflow execution:
 * - How many events were parsed
 * - How many were successfully processed
 * - How many had errors
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkStats() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('📊 Статистика обработки событий из последнего исполнения workflow...\n');

    // Get execution time range (last 30 minutes to catch recent execution)
    const timeRange = await sql`
      SELECT 
        NOW() - INTERVAL '30 minutes' as start_time,
        NOW() as end_time
    `;
    
    const startTime = timeRange[0].start_time;
    const endTime = timeRange[0].end_time;

    console.log(`Временной диапазон: ${startTime} - ${endTime}\n`);

    // Total records added in this period
    const totalRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
    `;

    console.log(`📥 Всего записей добавлено в history: ${totalRecords[0].count}\n`);

    if (parseInt(totalRecords[0].count) === 0) {
      console.log('⚠️ Записей не найдено за последние 30 минут.');
      console.log('   Возможно, workflow ещё не запускался или данные старше.');
      return;
    }

    // Successfully processed (processed = TRUE, error_code = NULL)
    const successRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
        AND processed = TRUE
        AND error_code IS NULL
    `;

    console.log(`✅ Успешно обработано: ${successRecords[0].count}`);

    // Failed (error_code IS NOT NULL)
    const failedRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
        AND error_code IS NOT NULL
    `;

    console.log(`❌ С ошибками: ${failedRecords[0].count}`);

    // Not processed yet (processed = FALSE)
    const notProcessed = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
        AND processed = FALSE
    `;

    console.log(`⏳ Ещё не обработано: ${notProcessed[0].count}\n`);

    // Statistics by entity_type
    console.log('📈 Статистика по типам сущностей:\n');
    const byEntityType = await sql`
      SELECT 
        entity_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_code IS NULL) as success,
        COUNT(*) FILTER (WHERE error_code IS NOT NULL) as errors,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
      GROUP BY entity_type
      ORDER BY total DESC
    `;

    byEntityType.forEach(stat => {
      console.log(`  ${stat.entity_type || 'NULL'}:`);
      console.log(`    Всего: ${stat.total}`);
      console.log(`    ✅ Успешно: ${stat.success}`);
      console.log(`    ❌ Ошибки: ${stat.errors}`);
      console.log(`    ⏳ Ожидает: ${stat.pending}`);
      console.log('');
    });

    // Error codes breakdown
    if (parseInt(failedRecords[0].count) > 0) {
      console.log('🔍 Детализация ошибок:\n');
      const errorBreakdown = await sql`
        SELECT 
          error_code,
          COUNT(*) as count
        FROM history
        WHERE created_at >= ${startTime}
          AND created_at <= ${endTime}
          AND error_code IS NOT NULL
        GROUP BY error_code
        ORDER BY count DESC
      `;

      for (const err of errorBreakdown) {
        const desc = await sql`
          SELECT get_history_error_description(${err.error_code}) as description
        `;
        console.log(`  ${err.error_code}: ${err.count} записей`);
        console.log(`    ${desc[0].description}`);
        console.log('');
      }

      // Show sample errors
      console.log('📜 Примеры записей с ошибками:\n');
      const sampleErrors = await sql`
        SELECT 
          id,
          entity_type,
          entity_id,
          error_code,
          description
        FROM history
        WHERE created_at >= ${startTime}
          AND created_at <= ${endTime}
          AND error_code IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      `;

      sampleErrors.forEach((record, idx) => {
        console.log(`  [${idx + 1}] ID: ${record.id}`);
        console.log(`      Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
        console.log(`      Код: ${record.error_code}`);
        console.log(`      Описание: ${(record.description || '').substring(0, 80)}...`);
        console.log('');
      });
    }

    // Success rate
    const successRate = totalRecords[0].count > 0 
      ? ((parseInt(successRecords[0].count) / parseInt(totalRecords[0].count)) * 100).toFixed(1)
      : 0;

    console.log('─'.repeat(60));
    console.log(`📊 Процент успешной обработки: ${successRate}%`);
    console.log('─'.repeat(60));

    // Recent records timeline
    console.log('\n📅 Последние 10 записей:\n');
    const recent = await sql`
      SELECT 
        id,
        created_at,
        entity_type,
        entity_id,
        processed,
        error_code,
        description
      FROM history
      WHERE created_at >= ${startTime}
        AND created_at <= ${endTime}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    recent.forEach((record, idx) => {
      const status = record.processed && !record.error_code ? '✅' 
                   : record.error_code ? '❌' 
                   : '⏳';
      console.log(`  [${idx + 1}] ${status} ID: ${record.id} | ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
      console.log(`      ${record.created_at.toISOString()}`);
      if (record.error_code) {
        console.log(`      ${record.error_code}`);
      }
      console.log(`      ${(record.description || '').substring(0, 70)}...`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkStats().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

