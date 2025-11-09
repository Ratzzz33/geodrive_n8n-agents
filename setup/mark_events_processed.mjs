/**
 * Пометить все события как обработанные
 * Это позволит системе начать автоматически создавать связи для новых событий
 */

import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('✅ Пометка событий как обработанные\n');

  try {
    // 1. Статистика до
    const [beforeStats] = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed
      FROM events
    `;
    
    console.log('📊 До обновления:');
    console.log(`  Всего событий: ${beforeStats.total}`);
    console.log(`  Обработано: ${beforeStats.processed}`);
    console.log(`  Не обработано: ${beforeStats.unprocessed}\n`);

    // 2. Обновить events
    console.log('🔄 Обновление events...');
    const eventsResult = await sql`
      UPDATE events
      SET processed = TRUE
      WHERE processed = FALSE
      RETURNING id
    `;
    console.log(`  ✓ Обновлено ${eventsResult.length} событий\n`);

    // 3. Обновить history
    console.log('🔄 Обновление history...');
    const historyResult = await sql`
      UPDATE history
      SET processed = TRUE
      WHERE processed = FALSE
      RETURNING id
    `;
    console.log(`  ✓ Обновлено ${historyResult.length} записей\n`);

    // 4. Статистика после
    const [afterStats] = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed
      FROM events
    `;
    
    console.log('📊 После обновления:');
    console.log(`  Всего событий: ${afterStats.total}`);
    console.log(`  Обработано: ${afterStats.processed}`);
    console.log(`  Не обработано: ${afterStats.unprocessed}\n`);

    console.log('🎉 Все события помечены как обработанные!');
    console.log('   Теперь система будет автоматически создавать связи для новых событий.\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

