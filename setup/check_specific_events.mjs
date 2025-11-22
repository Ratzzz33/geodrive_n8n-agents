#!/usr/bin/env node

/**
 * Check if specific events are in the database
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkEvents() {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log('🔍 Проверка наличия событий в БД...\n');

    const events = [
      {
        time: '20 нояб. 25 13:51',
        description: 'Николай Фомин , принял от Данияр Байбаков 400.0 GEL, платежи №1866155/1866156',
        searchTerms: ['Николай Фомин', '1866155', '1866156', '400.0 GEL']
      },
      {
        time: '20 нояб. 25 11:01',
        description: 'Данияр Байбаков изменил , mileage с 118316 на 118830 в авто № 61936 - Toyota Camry 174',
        searchTerms: ['Данияр Байбаков', 'mileage', '61936', '118316', '118830']
      },
      {
        time: '20 нояб. 25 10:00',
        description: 'Eliseev Aleksei Jr создал платёж №1865532, расход наличными 3.0GEL',
        searchTerms: ['Eliseev Aleksei Jr', '1865532', '3.0GEL']
      },
      {
        time: '20 нояб. 25 9:58',
        description: 'Аркадий Юров изменил , company_id с 9506 на 9247 в авто № 55207 - SantaFe 438 2021',
        searchTerms: ['Аркадий Юров', 'company_id', '55207', '9506', '9247']
      },
      {
        time: '20 нояб. 25 8:36',
        description: 'Elvin создал платёж №1865442, расход наличными 4.0GEL',
        searchTerms: ['Elvin', '1865442', '4.0GEL']
      },
      {
        time: '20 нояб. 25 7:46',
        description: 'Николай Фомин создал платёж №1865401, расход наличными 28.0GEL',
        searchTerms: ['Николай Фомин', '1865401', '28.0GEL']
      }
    ];

    const results = [];

    for (const event of events) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📅 ${event.time}`);
      console.log(`📝 ${event.description}\n`);

      // Build search query - search for records that contain all search terms
      const searchConditions = event.searchTerms.map(term => 
        `description ILIKE '%${term}%'`
      ).join(' AND ');

      const query = `
        SELECT 
          id,
          ts,
          created_at,
          branch,
          operation_type,
          entity_type,
          entity_id,
          processed,
          error_code,
          notes,
          description
        FROM history
        WHERE ${searchConditions}
        ORDER BY created_at DESC
        LIMIT 5
      `;

      const records = await sql.unsafe(query);

      if (records.length === 0) {
        console.log('❌ НЕ НАЙДЕНО в БД');
        results.push({
          event,
          found: false,
          record: null
        });
      } else {
        const record = records[0]; // Take the most recent match
        const status = record.processed && !record.error_code ? '✅ УСПЕШНО' 
                     : record.error_code ? `❌ ОШИБКА: ${record.error_code}` 
                     : '⏳ ОЖИДАЕТ';
        
        console.log(`✅ НАЙДЕНО в БД`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Время создания: ${record.created_at.toISOString()}`);
        console.log(`   Филиал: ${record.branch || 'NULL'}`);
        console.log(`   Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
        console.log(`   Статус: ${status}`);
        
        if (record.error_code) {
          const errorDesc = await sql`
            SELECT get_history_error_description(${record.error_code}) as description
          `;
          console.log(`   Описание ошибки: ${errorDesc[0].description}`);
        }
        
        if (record.notes) {
          console.log(`   Заметки: ${record.notes.substring(0, 150)}...`);
        }

        results.push({
          event,
          found: true,
          record
        });
      }
    }

    // Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:\n');
    
    const found = results.filter(r => r.found).length;
    const notFound = results.filter(r => !r.found).length;
    const success = results.filter(r => r.found && r.record && r.record.processed && !r.record.error_code).length;
    const errors = results.filter(r => r.found && r.record && r.record.error_code).length;
    const pending = results.filter(r => r.found && r.record && !r.record.processed).length;

    console.log(`Всего событий проверено: ${results.length}`);
    console.log(`✅ Найдено в БД: ${found}`);
    console.log(`❌ Не найдено: ${notFound}`);
    console.log(`✅ Успешно обработано: ${success}`);
    console.log(`❌ С ошибками: ${errors}`);
    console.log(`⏳ Ожидает обработки: ${pending}`);
    console.log(`${'═'.repeat(60)}`);

    // List not found events
    if (notFound > 0) {
      console.log('\n⚠️ События, которые НЕ найдены в БД:\n');
      results.filter(r => !r.found).forEach((result, idx) => {
        console.log(`  [${idx + 1}] ${result.event.time}`);
        console.log(`      ${result.event.description.substring(0, 80)}...`);
        console.log('');
      });
    }

    // List events with errors
    if (errors > 0) {
      console.log('\n❌ События с ошибками:\n');
      results.filter(r => r.found && r.record && r.record.error_code).forEach((result, idx) => {
        console.log(`  [${idx + 1}] ${result.event.time}`);
        console.log(`      Код ошибки: ${result.record.error_code}`);
        console.log(`      ${result.event.description.substring(0, 80)}...`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

checkEvents().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

