#!/usr/bin/env node

/**
 * Check all recent history records to understand why only 2 were added
 * from 818 items in execution
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkAllRecent() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('📊 Анализ всех недавних записей в history...\n');

    // Check last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Total records
    const total = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE created_at >= ${twoHoursAgo}
    `;

    console.log(`📥 Всего записей за последние 2 часа: ${total[0].count}\n`);

    // Statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_code IS NULL) as success,
        COUNT(*) FILTER (WHERE error_code IS NOT NULL) as errors,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM history
      WHERE created_at >= ${twoHoursAgo}
    `;

    console.log('📈 Общая статистика:');
    console.log(`   Всего: ${stats[0].total}`);
    console.log(`   ✅ Успешно: ${stats[0].success}`);
    console.log(`   ❌ Ошибки: ${stats[0].errors}`);
    console.log(`   ⏳ Ожидает: ${stats[0].pending}\n`);

    // By branch
    console.log('📊 По филиалам:\n');
    const byBranch = await sql`
      SELECT 
        branch,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_code IS NULL) as success,
        COUNT(*) FILTER (WHERE error_code IS NOT NULL) as errors
      FROM history
      WHERE created_at >= ${twoHoursAgo}
      GROUP BY branch
      ORDER BY total DESC
    `;

    byBranch.forEach(stat => {
      console.log(`  ${stat.branch || 'NULL'}:`);
      console.log(`    Всего: ${stat.total}`);
      console.log(`    ✅ Успешно: ${stat.success}`);
      console.log(`    ❌ Ошибки: ${stat.errors}`);
      console.log('');
    });

    // By entity type
    console.log('📊 По типам сущностей:\n');
    const byEntity = await sql`
      SELECT 
        entity_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE AND error_code IS NULL) as success,
        COUNT(*) FILTER (WHERE error_code IS NOT NULL) as errors
      FROM history
      WHERE created_at >= ${twoHoursAgo}
      GROUP BY entity_type
      ORDER BY total DESC
    `;

    byEntity.forEach(stat => {
      console.log(`  ${stat.entity_type || 'NULL'}:`);
      console.log(`    Всего: ${stat.total}`);
      console.log(`    ✅ Успешно: ${stat.success}`);
      console.log(`    ❌ Ошибки: ${stat.errors}`);
      console.log('');
    });

    // Recent records with timestamps
    console.log('📜 Последние 20 записей:\n');
    const recent = await sql`
      SELECT 
        id,
        created_at,
        branch,
        entity_type,
        entity_id,
        processed,
        error_code,
        description
      FROM history
      WHERE created_at >= ${twoHoursAgo}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    recent.forEach((record, idx) => {
      const status = record.processed && !record.error_code ? '✅' 
                   : record.error_code ? `❌ ${record.error_code}` 
                   : '⏳';
      console.log(`[${idx + 1}] ${status} ID: ${record.id}`);
      console.log(`    ${record.created_at.toISOString()} | ${record.branch || 'NULL'}`);
      console.log(`    ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
      console.log(`    ${(record.description || '').substring(0, 70)}...`);
      console.log('');
    });

    // Error summary
    if (parseInt(stats[0].errors) > 0) {
      console.log('🔍 Ошибки за последние 2 часа:\n');
      const errors = await sql`
        SELECT 
          error_code,
          COUNT(*) as count
        FROM history
        WHERE created_at >= ${twoHoursAgo}
          AND error_code IS NOT NULL
        GROUP BY error_code
        ORDER BY count DESC
      `;

      for (const err of errors) {
        const desc = await sql`
          SELECT get_history_error_description(${err.error_code}) as description
        `;
        console.log(`  ${err.error_code}: ${err.count} записей`);
        console.log(`    ${desc[0].description}`);
        console.log('');
      }
    }

    // Success rate
    const successRate = stats[0].total > 0 
      ? ((parseInt(stats[0].success) / parseInt(stats[0].total)) * 100).toFixed(1)
      : 0;

    console.log('─'.repeat(60));
    console.log(`📊 ИТОГО за последние 2 часа:`);
    console.log(`   Всего событий: ${stats[0].total}`);
    console.log(`   ✅ Успешно обработано: ${stats[0].success} (${successRate}%)`);
    console.log(`   ❌ С ошибками: ${stats[0].errors}`);
    console.log(`   ⏳ Ожидает обработки: ${stats[0].pending}`);
    console.log('─'.repeat(60));

    console.log('\n💡 Примечание:');
    console.log('   Workflow обрабатывает много событий из RentProg,');
    console.log('   но сохраняет в history только новые/уникальные события');
    console.log('   (используется ON CONFLICT DO NOTHING по уникальному ключу).');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkAllRecent().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

