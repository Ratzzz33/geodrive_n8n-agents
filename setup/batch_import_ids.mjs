#!/usr/bin/env node

/**
 * Пакетный импорт ID - читает JSON файл и импортирует порциями
 */

import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 100; // Импортируем по 100 за раз

console.log('🔄 Запуск пакетного импорта ID...\n');

async function batchImport() {
  try {
    // Проверяем есть ли файл с полным списком
    const fullFile = 'umnico_chat_ids_full.json';
    const oldFile = 'umnico_chat_ids.json';
    
    let data;
    if (existsSync(fullFile)) {
      console.log(`📂 Загрузка ${fullFile}...`);
      data = JSON.parse(readFileSync(fullFile, 'utf-8'));
    } else if (existsSync(oldFile)) {
      console.log(`📂 Загрузка ${oldFile}...`);
      data = JSON.parse(readFileSync(oldFile, 'utf-8'));
    } else {
      console.error('❌ Файл с ID не найден');
      process.exit(1);
    }
    
    const allIds = data.ids || [];
    console.log(`📋 Всего ID для импорта: ${allIds.length}\n`);
    
    let saved = 0;
    let skipped = 0;
    
    // Импортируем порциями
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      
      for (const id of batch) {
        try {
          const result = await sql`
            INSERT INTO umnico_chat_ids (id, source, metadata)
            VALUES (${id}, 'chrome_mcp_batch', ${JSON.stringify({ 
              collected_at: data.collected_at || new Date().toISOString(),
              total_batch: allIds.length 
            })})
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
      
      const processed = i + batch.length;
      console.log(`   Обработано: ${processed}/${allIds.length} (новых: ${saved}, было: ${skipped})`);
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
    console.log(`   Всего ID в БД: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает синхронизации: ${stats[0].pending}\n`);
    
    console.log('🚀 Готово! Для синхронизации запустите:');
    console.log('   node setup/sync_umnico_conversations.mjs\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

batchImport().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

