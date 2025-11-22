#!/usr/bin/env node

/**
 * Quick search for history errors by error code
 * Usage: node setup/find_history_error.mjs HISTORY_ERR_ENTITY_NOT_FOUND
 * 
 * This script is optimized for quick lookup when user sends just the error code
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function findError(errorCode) {
  const sql = postgres(CONNECTION_STRING, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10
  });

  try {
    // Normalize error code (remove extra spaces, convert to uppercase)
    errorCode = errorCode.trim().toUpperCase();
    
    // If user didn't include prefix, add it
    if (!errorCode.startsWith('HISTORY_ERR_')) {
      if (errorCode.startsWith('ERR_')) {
        errorCode = 'HISTORY_' + errorCode;
      } else {
        errorCode = 'HISTORY_ERR_' + errorCode;
      }
    }

    console.log(`🔍 Поиск записей с кодом ошибки: ${errorCode}\n`);

    // Get error description
    const errorDesc = await sql`
      SELECT get_history_error_description(${errorCode}) as description
    `;
    
    console.log(`📝 Описание ошибки: ${errorDesc[0].description}\n`);

    // Find all records with this error code
    const records = await sql`
      SELECT 
        id,
        ts,
        created_at,
        branch,
        operation_type,
        entity_type,
        entity_id,
        description,
        notes,
        processed
      FROM history
      WHERE error_code = ${errorCode}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    if (records.length === 0) {
      console.log('✅ Записей с этим кодом ошибки не найдено.');
      console.log('   Возможно, ошибка уже исправлена или код указан неверно.\n');
      
      // Suggest similar codes
      const similar = await sql`
        SELECT DISTINCT error_code
        FROM history
        WHERE error_code IS NOT NULL
          AND error_code LIKE ${'%' + errorCode.replace('HISTORY_ERR_', '') + '%'}
        LIMIT 5
      `;
      
      if (similar.length > 0) {
        console.log('💡 Похожие коды ошибок:');
        similar.forEach(row => {
          console.log(`   ${row.error_code}`);
        });
      }
      return;
    }

    console.log(`📊 Найдено записей: ${records.length}\n`);

    // Show summary
    const byBranch = await sql`
      SELECT branch, COUNT(*) as count
      FROM history
      WHERE error_code = ${errorCode}
      GROUP BY branch
      ORDER BY count DESC
    `;
    
    if (byBranch.length > 0) {
      console.log('📈 По филиалам:');
      byBranch.forEach(stat => {
        console.log(`   ${stat.branch || 'NULL'}: ${stat.count}`);
      });
      console.log('');
    }

    // Show recent records
    console.log('📜 Последние записи:\n');
    records.forEach((record, idx) => {
      console.log(`[${idx + 1}] ID: ${record.id}`);
      console.log(`    Время: ${record.ts || record.created_at}`);
      console.log(`    Филиал: ${record.branch || 'NULL'}`);
      console.log(`    Entity: ${record.entity_type || 'NULL'} / ${record.entity_id || 'NULL'}`);
      console.log(`    Обработано: ${record.processed ? '✅' : '❌'}`);
      console.log(`    Описание: ${(record.description || '').substring(0, 100)}...`);
      if (record.notes) {
        console.log(`    Заметки: ${record.notes.substring(0, 150)}...`);
      }
      console.log('');
    });

    // Total count
    const total = await sql`
      SELECT COUNT(*) as count
      FROM history
      WHERE error_code = ${errorCode}
    `;
    
    if (total[0].count > records.length) {
      console.log(`📊 Всего записей с этим кодом: ${total[0].count} (показано ${records.length})`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

const errorCode = process.argv[2];
if (!errorCode) {
  console.log('Использование: node setup/find_history_error.mjs <error_code>');
  console.log('');
  console.log('Примеры:');
  console.log('  node setup/find_history_error.mjs HISTORY_ERR_ENTITY_NOT_FOUND');
  console.log('  node setup/find_history_error.mjs ERR_ENTITY_NOT_FOUND  (префикс добавится автоматически)');
  console.log('  node setup/find_history_error.mjs ENTITY_NOT_FOUND  (префикс добавится автоматически)');
  process.exit(1);
}

findError(errorCode).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

