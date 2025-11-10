/**
 * Обработка необработанных событий через Jarvis API
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const JARVIS_API_URL = process.env.JARVIS_API_URL || 'http://46.224.17.15:3000';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function processUnprocessedEvents() {
  console.log('🔄 Обработка необработанных событий...\n');

  try {
    // 1. Получить список необработанных событий
    // В таблице events нет поля branch, используем company_id для определения филиала
    const unprocessed = await sql`
      SELECT id, type, ext_id, ts, company_id, entity_type, rentprog_id
      FROM events
      WHERE processed = false OR processed IS NULL
      ORDER BY ts ASC
      LIMIT 100
    `;

    console.log(`📊 Найдено ${unprocessed.length} необработанных событий\n`);

    if (unprocessed.length === 0) {
      console.log('✅ Все события обработаны!');
      return;
    }

    // 2. Обработать каждое событие
    let processed = 0;
    let errors = 0;

    // Маппинг company_id -> branch
    // В RentProg company_id (4-5 цифр) означает ID филиала
    const companyToBranch = {
      9247: 'tbilisi',
      9248: 'kutaisi',
      9506: 'batumi',
      11163: 'service-center',
    };

    for (const event of unprocessed) {
      try {
        // Определить branch по company_id
        const branch = companyToBranch[event.company_id] || 'tbilisi';
        
        const response = await fetch(`${JARVIS_API_URL}/process-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branch: branch,
            type: event.type,
            ext_id: event.ext_id || event.rentprog_id,
            eventId: event.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Ошибка обработки события ${event.id}: ${response.status} - ${errorText}`);
          errors++;
          continue;
        }

        const result = await response.json();
        
        if (result.ok) {
          // Пометить как обработанное
          await sql`
            UPDATE events
            SET processed = true
            WHERE id = ${event.id}
          `;
          
          processed++;
          console.log(`✅ Обработано событие ${event.id} (${event.type}, branch: ${branch})`);
        } else {
          console.error(`❌ Ошибка обработки события ${event.id}: ${result.error || 'Unknown error'}`);
          errors++;
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Ошибка при обработке события ${event.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 Результат:`);
    console.log(`   ✅ Обработано: ${processed}`);
    console.log(`   ❌ Ошибок: ${errors}`);

    // 3. Проверить оставшиеся необработанные события
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE processed = false OR processed IS NULL
    `;

    console.log(`\n📋 Осталось необработанных: ${remaining[0].count}`);

    if (remaining[0].count > 0) {
      console.log('\n💡 Запустите скрипт снова для обработки оставшихся событий');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

processUnprocessedEvents().catch(console.error);

