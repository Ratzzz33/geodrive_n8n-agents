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

// Connection string из документации (fallback если нет в .env)
const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
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
    // Сначала убедимся, что таблица существует
    console.log('📝 Проверка таблицы umnico_chat_ids...');
    await sql`
      CREATE TABLE IF NOT EXISTS umnico_chat_ids (
        id TEXT PRIMARY KEY,
        discovered_at TIMESTAMPTZ DEFAULT NOW(),
        source TEXT,
        processed BOOLEAN DEFAULT FALSE,
        last_sync_at TIMESTAMPTZ,
        metadata JSONB
      )
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_processed 
      ON umnico_chat_ids(processed) 
      WHERE processed = FALSE
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_umnico_chat_ids_discovered 
      ON umnico_chat_ids(discovered_at DESC)
    `;
    
    console.log('✅ Таблица готова\n');
    
    let ids = [];
    let source = 'manual_collection';
    let metadata = {};
    
    // Если передан объект с полем ids
    if (chatIdsData.ids && Array.isArray(chatIdsData.ids)) {
      ids = chatIdsData.ids;
      source = chatIdsData.source || source;
      metadata = {
        total: chatIdsData.total || ids.length,
        collected_at: chatIdsData.collected_at,
        source: chatIdsData.source
      };
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
    
    console.log(`📝 Сохранение ${ids.length} ID чатов...`);
    console.log(`   Источник: ${source}\n`);
    
    let saved = 0;
    let skipped = 0;
    
    // Используем batch insert для ускорения
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      
      for (const id of batch) {
        try {
          const result = await sql`
            INSERT INTO umnico_chat_ids (id, source, metadata)
            VALUES (${String(id)}, ${source}, ${JSON.stringify(metadata)})
            ON CONFLICT (id) DO NOTHING
            RETURNING id
          `;
          
          if (result.length > 0) {
            saved++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`❌ Ошибка сохранения ID ${id}:`, error.message);
        }
      }
      
      if ((saved + skipped) % 100 === 0 || (saved + skipped) === ids.length) {
        console.log(`   Обработано: ${saved + skipped}/${ids.length} (сохранено: ${saved}, пропущено: ${skipped})`);
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

