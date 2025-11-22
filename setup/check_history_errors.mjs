#!/usr/bin/env node

/**
 * Check history records with errors (error_code is not NULL)
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkErrors() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка записей с ошибками обработки...\n');

    // Count errors by code
    const errorStats = await sql`
      SELECT 
        error_code,
        COUNT(*) as count
      FROM history
      WHERE error_code IS NOT NULL
      GROUP BY error_code
      ORDER BY count DESC
    `;

    if (errorStats.length === 0) {
      console.log('✅ Нет записей с ошибками! Все события обработаны успешно.\n');
      return;
    }

    console.log('📊 Статистика ошибок:');
    errorStats.forEach(stat => {
      console.log(`  ${stat.error_code}: ${stat.count} записей`);
    });

    // Get error descriptions
    console.log('\n📝 Описания ошибок:');
    for (const stat of errorStats) {
      const desc = await sql`
        SELECT get_history_error_description(${stat.error_code}) as description
      `;
      console.log(`  ${stat.error_code}: ${desc[0].description}`);
    }

    // Show recent errors
    console.log('\n📜 Последние записи с ошибками (топ 10):');
    const recentErrors = await sql`
      SELECT 
        id,
        ts,
        branch,
        operation_type,
        entity_type,
        entity_id,
        error_code,
        description,
        notes
      FROM history
      WHERE error_code IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (recentErrors.length === 0) {
      console.log('  Нет записей');
    } else {
      recentErrors.forEach((record, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${record.id}`);
        console.log(`      Время: ${record.ts}`);
        console.log(`      Филиал: ${record.branch}`);
        console.log(`      Код ошибки: ${record.error_code}`);
        console.log(`      Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
        console.log(`      Описание: ${(record.description || '').substring(0, 80)}...`);
        if (record.notes) {
          console.log(`      Заметки: ${record.notes.substring(0, 100)}...`);
        }
      });
    }

    // Total count
    const totalErrors = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE error_code IS NOT NULL
    `;
    console.log(`\n📈 Всего записей с ошибками: ${totalErrors[0].count}`);

    // Total processed successfully
    const totalSuccess = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE processed = TRUE AND error_code IS NULL
    `;
    console.log(`✅ Всего успешно обработано: ${totalSuccess[0].count}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkErrors().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

