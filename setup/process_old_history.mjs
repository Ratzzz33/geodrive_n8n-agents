#!/usr/bin/env node
/**
 * Обработка старых записей history от старых к новым
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function processOldHistory() {
  console.log('\n🔄 Обработка старых записей history\n');
  console.log('='.repeat(80));

  try {
    // Получаем статистику
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed_count,
        COUNT(*) FILTER (WHERE processed = FALSE OR processed IS NULL) as unprocessed_count
      FROM history
    `;

    const total = parseInt(stats[0].total);
    const processed = parseInt(stats[0].processed_count);
    const unprocessed = parseInt(stats[0].unprocessed_count);

    console.log(`\n📊 Статистика:`);
    console.log(`   Всего записей: ${total}`);
    console.log(`   Обработано: ${processed}`);
    console.log(`   Не обработано: ${unprocessed}\n`);

    if (unprocessed === 0) {
      console.log('✅ Все записи уже обработаны!\n');
      return;
    }

    // Получаем необработанные записи от старых к новым
    const unprocessedRecords = await sql`
      SELECT * FROM get_pending_history_for_processing(1000)
    `;

    console.log(`\n🔄 Обработка ${unprocessedRecords.length} записей...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < unprocessedRecords.length; i++) {
      const record = unprocessedRecords[i];
      
      try {
        // Обновляем запись чтобы триггер сработал
        await sql`
          UPDATE history 
          SET notes = COALESCE(notes, '') || ' | Batch processing'
          WHERE id = ${record.id}
        `;

        // Проверяем результат
        const updated = await sql`
          SELECT processed, notes
          FROM history
          WHERE id = ${record.id}
        `;

        if (updated[0].processed) {
          successCount++;
          if ((i + 1) % 100 === 0) {
            console.log(`   [${i + 1}/${unprocessedRecords.length}] Обработано: ${successCount} успешно, ${errorCount} ошибок`);
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`   [${i + 1}] Ошибка обработки записи ${record.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Обработка завершена:`);
    console.log(`   Успешно: ${successCount}`);
    console.log(`   Ошибок: ${errorCount}`);
    console.log(`   Всего: ${unprocessedRecords.length}\n`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

processOldHistory().catch(console.error);

