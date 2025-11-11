#!/usr/bin/env node

/**
 * Импорт новых ID напрямую из массива
 */

import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

// Вставьте сюда массив ID из браузера (из аргумента командной строки)
const idsJson = process.argv[2];

if (!idsJson) {
  console.error('❌ Передайте массив ID как аргумент');
  console.error('Использование: node setup/import_new_ids_from_browser.mjs \'["id1","id2",...]\'');
  process.exit(1);
}

let ids;
try {
  ids = JSON.parse(idsJson);
} catch (error) {
  console.error('❌ Ошибка парсинга JSON:', error.message);
  process.exit(1);
}

console.log(`🔄 Импорт ${ids.length} ID в БД...\n`);

async function importIds() {
  try {
    let saved = 0;
    let skipped = 0;
    
    for (const id of ids) {
      try {
        const result = await sql`
          INSERT INTO umnico_chat_ids (id, source, metadata)
          VALUES (${id}, 'chrome_mcp_extended', ${JSON.stringify({ 
            collected_at: new Date().toISOString(),
            total_batch: ids.length 
          })})
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        
        if (result.length > 0) {
          saved++;
        } else {
          skipped++;
        }
        
        if ((saved + skipped) % 100 === 0) {
          console.log(`   Обработано: ${saved + skipped}/${ids.length} (новых: ${saved}, было: ${skipped})`);
        }
      } catch (error) {
        console.error(`❌ Ошибка сохранения ID ${id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Импорт завершен:`);
    console.log(`   Добавлено новых: ${saved}`);
    console.log(`   Уже было в БД: ${skipped}`);
    console.log(`   Всего обработано: ${saved + skipped}\n`);
    
    // Статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('📊 Итоговая статистика БД:');
    console.log(`   Всего ID: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает синхронизации: ${stats[0].pending}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

importIds().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

