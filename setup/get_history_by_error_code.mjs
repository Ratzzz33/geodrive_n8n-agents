#!/usr/bin/env node

/**
 * Get history record details by error_code or ID
 * Usage: node setup/get_history_by_error_code.mjs <error_code_or_id>
 * Example: node setup/get_history_by_error_code.mjs ERR_ENTITY_NOT_FOUND
 * Example: node setup/get_history_by_error_code.mjs 12345
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function getHistoryRecord(searchTerm) {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    console.log(`🔍 Поиск записи: ${searchTerm}\n`);

    let records;
    
    // Check if searchTerm is a number (ID) or error code
    if (/^\d+$/.test(searchTerm)) {
      // Search by ID
      records = await sql`
        SELECT *
        FROM history
        WHERE id = ${parseInt(searchTerm)}
        LIMIT 1
      `;
    } else {
      // Search by error_code
      records = await sql`
        SELECT *
        FROM history
        WHERE error_code = ${searchTerm}
        ORDER BY created_at DESC
        LIMIT 10
      `;
    }

    if (records.length === 0) {
      console.log('❌ Запись не найдена');
      return;
    }

    console.log(`✅ Найдено записей: ${records.length}\n`);

    for (const record of records) {
      console.log('─'.repeat(60));
      console.log(`ID: ${record.id}`);
      console.log(`Время: ${record.ts || record.created_at}`);
      console.log(`Филиал: ${record.branch}`);
      console.log(`Тип операции: ${record.operation_type}`);
      console.log(`Entity Type: ${record.entity_type || 'NULL'}`);
      console.log(`Entity ID: ${record.entity_id || 'NULL'}`);
      console.log(`Обработано: ${record.processed ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`Код ошибки: ${record.error_code || 'NULL (успешно обработано)'}`);
      
      if (record.error_code) {
        const errorDesc = await sql`
          SELECT get_history_error_description(${record.error_code}) as description
        `;
        console.log(`Описание ошибки: ${errorDesc[0].description}`);
      }
      
      console.log(`\nОписание:`);
      console.log(`  ${record.description || 'NULL'}`);
      
      if (record.notes) {
        console.log(`\nЗаметки:`);
        console.log(`  ${record.notes}`);
      }
      
      if (record.raw_data && typeof record.raw_data === 'object') {
        console.log(`\nRaw Data:`);
        console.log(JSON.stringify(record.raw_data, null, 2));
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

const searchTerm = process.argv[2];
if (!searchTerm) {
  console.log('Использование: node setup/get_history_by_error_code.mjs <error_code_or_id>');
  console.log('Примеры:');
  console.log('  node setup/get_history_by_error_code.mjs ERR_ENTITY_NOT_FOUND');
  console.log('  node setup/get_history_by_error_code.mjs 12345');
  process.exit(1);
}

getHistoryRecord(searchTerm).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

