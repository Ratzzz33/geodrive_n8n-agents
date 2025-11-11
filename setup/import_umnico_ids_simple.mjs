#!/usr/bin/env node

/**
 * Простой импорт ID чатов Umnico в БД
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';

// Hardcoded connection string (из документации)
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

console.log('🔄 Импорт ID чатов Umnico в БД...\n');

async function importIds() {
  try {
    // 1. Создать таблицу
    console.log('📝 Создание таблицы umnico_chat_ids...');
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
    
    console.log('✅ Таблица создана\n');
    
    // 2. Загрузить данные из файла
    console.log('📂 Загрузка данных из umnico_chat_ids.json...');
    const data = JSON.parse(readFileSync('umnico_chat_ids.json', 'utf-8'));
    const ids = data.ids;
    
    console.log(`📋 Найдено ${ids.length} ID чатов\n`);
    
    // 3. Импорт в БД
    console.log('💾 Импорт в БД...');
    let saved = 0;
    let skipped = 0;
    
    for (const id of ids) {
      try {
        const result = await sql`
          INSERT INTO umnico_chat_ids (id, source, metadata)
          VALUES (${id}, 'chrome_mcp_collection', ${JSON.stringify({ 
            collected_at: data.collected_at,
            total_batch: data.total 
          })})
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        
        if (result.length > 0) {
          saved++;
        } else {
          skipped++;
        }
        
        if ((saved + skipped) % 50 === 0) {
          console.log(`   Обработано: ${saved + skipped}/${ids.length} (сохранено: ${saved}, пропущено: ${skipped})`);
        }
      } catch (error) {
        console.error(`❌ Ошибка сохранения ID ${id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Импорт завершен:`);
    console.log(`   Сохранено новых: ${saved}`);
    console.log(`   Пропущено (уже были): ${skipped}`);
    console.log(`   Всего обработано: ${saved + skipped}\n`);
    
    // 4. Статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('📊 Статистика БД:');
    console.log(`   Всего ID в БД: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает синхронизации: ${stats[0].pending}\n`);
    
    console.log('🚀 Готово! Теперь запустите синхронизацию:');
    console.log('   node setup/sync_umnico_conversations.mjs\n');
    
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

