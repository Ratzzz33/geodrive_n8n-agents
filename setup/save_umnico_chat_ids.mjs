#!/usr/bin/env node

/**
 * Сохранение собранных ID чатов Umnico в БД
 * 
 * Использование:
 * node setup/save_umnico_chat_ids.mjs chat_ids.json
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';

config();

const sql = postgres(process.env.NEON_CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Использование: node setup/save_umnico_chat_ids.mjs <file.json>');
  console.error('   или: node setup/save_umnico_chat_ids.mjs --stdin');
  process.exit(1);
}

async function saveChatIds(chatIdsData) {
  try {
    let ids = [];
    
    // Если передан объект с полем ids
    if (chatIdsData.ids && Array.isArray(chatIdsData.ids)) {
      ids = chatIdsData.ids;
    } 
    // Если передан просто массив
    else if (Array.isArray(chatIdsData)) {
      ids = chatIdsData;
    }
    // Если передана строка с ID через запятую
    else if (typeof chatIdsData === 'string') {
      ids = chatIdsData.split(',').map(id => id.trim());
    }
    
    if (ids.length === 0) {
      console.error('❌ Не найдено ID чатов в данных');
      return;
    }
    
    console.log(`📝 Сохранение ${ids.length} ID чатов...\n`);
    
    let saved = 0;
    let skipped = 0;
    
    for (const id of ids) {
      try {
        await sql`
          INSERT INTO umnico_chat_ids (id, source, metadata)
          VALUES (${id}, 'manual_collection', ${JSON.stringify({ total: ids.length })})
          ON CONFLICT (id) DO NOTHING
        `;
        
        const result = await sql`SELECT id FROM umnico_chat_ids WHERE id = ${id}`;
        if (result.length > 0) {
          saved++;
          if (saved % 10 === 0) {
            console.log(`✅ Сохранено: ${saved}/${ids.length}`);
          }
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Ошибка сохранения ID ${id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Результат:`);
    console.log(`   Сохранено: ${saved}`);
    console.log(`   Пропущено (уже были): ${skipped}`);
    console.log(`   Всего в БД: ${saved + skipped}\n`);
    
    // Показать статистику
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('📊 Статистика БД:');
    console.log(`   Всего ID: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает обработки: ${stats[0].pending}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Чтение данных
let data;

if (args[0] === '--stdin') {
  // Чтение из stdin
  let stdinData = '';
  process.stdin.on('data', chunk => { stdinData += chunk; });
  process.stdin.on('end', () => {
    try {
      data = JSON.parse(stdinData);
      saveChatIds(data);
    } catch (error) {
      console.error('❌ Ошибка парсинга JSON из stdin:', error);
      process.exit(1);
    }
  });
} else {
  // Чтение из файла
  try {
    const fileContent = readFileSync(args[0], 'utf-8');
    data = JSON.parse(fileContent);
    saveChatIds(data);
  } catch (error) {
    console.error('❌ Ошибка чтения файла:', error);
    process.exit(1);
  }
}

