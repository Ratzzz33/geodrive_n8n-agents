#!/usr/bin/env node

/**
 * Запуск парсинга всех необработанных Umnico ID в цикле
 * Использует существующий скрипт sync_umnico_conversations.mjs
 * 
 * Использование:
 *   node setup/run_umnico_parsing_loop.mjs
 *   node setup/run_umnico_parsing_loop.mjs --max-iterations 10
 */

import { spawn } from 'child_process';
import { config } from 'dotenv';
import postgres from 'postgres';

config();

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING || 
  'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const args = process.argv.slice(2);
const maxIterationsArg = args.find(arg => arg.startsWith('--max-iterations='));
const maxIterations = maxIterationsArg ? parseInt(maxIterationsArg.split('=')[1]) : null;

console.log('🔄 Запуск циклического парсинга Umnico ID...\n');
if (maxIterations) {
  console.log(`   Максимум итераций: ${maxIterations}\n`);
}

async function checkPendingCount() {
  const stats = await sql`
    SELECT COUNT(*) as pending
    FROM umnico_chat_ids
    WHERE processed = FALSE
  `;
  return parseInt(stats[0].pending);
}

async function runSyncScript() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['setup/sync_umnico_conversations.mjs'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    let iteration = 0;
    
    while (true) {
      iteration++;
      
      if (maxIterations && iteration > maxIterations) {
        console.log(`\n✅ Достигнут лимит итераций: ${maxIterations}`);
        break;
      }
      
      const pendingCount = await checkPendingCount();
      
      if (pendingCount === 0) {
        console.log('\n✅ Все ID обработаны!');
        break;
      }
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Итерация ${iteration} - Осталось необработанных: ${pendingCount}`);
      console.log('='.repeat(60) + '\n');
      
      try {
        await runSyncScript();
        console.log(`\n✅ Итерация ${iteration} завершена`);
      } catch (error) {
        console.error(`\n❌ Ошибка в итерации ${iteration}:`, error.message);
        // Продолжаем несмотря на ошибку
      }
      
      // Пауза между итерациями
      if (pendingCount > 0) {
        console.log('\n⏳ Пауза 10 секунд перед следующей итерацией...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    // Финальная статистика
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`   Всего ID в БД: ${stats[0].total}`);
    console.log(`   Обработано: ${stats[0].processed}`);
    console.log(`   Ожидает обработки: ${stats[0].pending}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

