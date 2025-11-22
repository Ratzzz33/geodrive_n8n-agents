#!/usr/bin/env node

/**
 * Check detailed statistics for the last workflow execution (24673)
 * Execution time: 2025-11-20T10:22:46 - 10:23:11
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkLastExecution() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('📊 Детальная статистика последнего исполнения workflow xSjwtwrrWUGcBduU\n');
    console.log('Execution ID: 24673');
    console.log('Время: 2025-11-20 10:22:46 - 10:23:11 UTC\n');

    // Check records created around execution time (10:22 - 10:24 UTC = 14:22 - 14:24 Tbilisi)
    const executionStart = new Date('2025-11-20T10:22:00Z'); // 14:22 Tbilisi
    const executionEnd = new Date('2025-11-20T10:24:00Z');   // 14:24 Tbilisi

    console.log(`Проверяем записи с ${executionStart.toISOString()} по ${executionEnd.toISOString()}\n`);

    // Total records
    const totalRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${executionStart}
        AND created_at <= ${executionEnd}
    `;

    console.log(`📥 Всего записей добавлено в history: ${totalRecords[0].count}\n`);

    if (parseInt(totalRecords[0].count) === 0) {
      console.log('⚠️ Записей не найдено в этом временном диапазоне.');
      console.log('   Проверяю расширенный диапазон (10:20 - 10:25)...\n');
      
      const extendedStart = new Date('2025-11-20T10:20:00Z');
      const extendedEnd = new Date('2025-11-20T10:25:00Z');
      
      const extendedTotal = await sql`
        SELECT COUNT(*) as count
        FROM history
        WHERE created_at >= ${extendedStart}
          AND created_at <= ${extendedEnd}
      `;
      
      console.log(`📥 Всего записей в расширенном диапазоне: ${extendedTotal[0].count}\n`);
      
      if (parseInt(extendedTotal[0].count) > 0) {
        const extendedRecords = await sql`
          SELECT 
            id,
            created_at,
            entity_type,
            entity_id,
            processed,
            error_code,
            description
          FROM history
          WHERE created_at >= ${extendedStart}
            AND created_at <= ${extendedEnd}
          ORDER BY created_at DESC
        `;
        
        console.log('📜 Записи в расширенном диапазоне:\n');
        extendedRecords.forEach((record, idx) => {
          const status = record.processed && !record.error_code ? '✅' 
                       : record.error_code ? '❌' 
                       : '⏳';
          console.log(`  [${idx + 1}] ${status} ID: ${record.id}`);
          console.log(`      Время: ${record.created_at.toISOString()}`);
          console.log(`      Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
          if (record.error_code) {
            console.log(`      Код ошибки: ${record.error_code}`);
          }
          console.log(`      Описание: ${(record.description || '').substring(0, 80)}...`);
          console.log('');
        });
      }
      return;
    }

    // Successfully processed
    const successRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${executionStart}
        AND created_at <= ${executionEnd}
        AND processed = TRUE
        AND error_code IS NULL
    `;

    console.log(`✅ Успешно обработано: ${successRecords[0].count}`);

    // Failed
    const failedRecords = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${executionStart}
        AND created_at <= ${executionEnd}
        AND error_code IS NOT NULL
    `;

    console.log(`❌ С ошибками: ${failedRecords[0].count}`);

    // Not processed
    const notProcessed = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${executionStart}
        AND created_at <= ${executionEnd}
        AND processed = FALSE
    `;

    console.log(`⏳ Ещё не обработано: ${notProcessed[0].count}\n`);

    // All records from this execution
    const allRecords = await sql`
      SELECT 
        id,
        created_at,
        branch,
        entity_type,
        entity_id,
        processed,
        error_code,
        description,
        notes
      FROM history
      WHERE created_at >= ${executionStart}
        AND created_at <= ${executionEnd}
      ORDER BY created_at DESC
    `;

    console.log('📜 Все записи из этого исполнения:\n');
    allRecords.forEach((record, idx) => {
      const status = record.processed && !record.error_code ? '✅ УСПЕШНО' 
                   : record.error_code ? `❌ ОШИБКА: ${record.error_code}` 
                   : '⏳ ОЖИДАЕТ';
      console.log(`[${idx + 1}] ${status}`);
      console.log(`    ID: ${record.id}`);
      console.log(`    Время: ${record.created_at.toISOString()}`);
      console.log(`    Филиал: ${record.branch || 'NULL'}`);
      console.log(`    Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
      console.log(`    Описание: ${(record.description || '').substring(0, 100)}...`);
      if (record.notes) {
        console.log(`    Заметки: ${record.notes.substring(0, 150)}...`);
      }
      console.log('');
    });

    // Summary
    const successRate = totalRecords[0].count > 0 
      ? ((parseInt(successRecords[0].count) / parseInt(totalRecords[0].count)) * 100).toFixed(1)
      : 0;

    console.log('─'.repeat(60));
    console.log(`📊 ИТОГО:`);
    console.log(`   Всего событий: ${totalRecords[0].count}`);
    console.log(`   ✅ Успешно обработано: ${successRecords[0].count}`);
    console.log(`   ❌ С ошибками: ${failedRecords[0].count}`);
    console.log(`   ⏳ Ожидает обработки: ${notProcessed[0].count}`);
    console.log(`   📈 Процент успеха: ${successRate}%`);
    console.log('─'.repeat(60));

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkLastExecution().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

