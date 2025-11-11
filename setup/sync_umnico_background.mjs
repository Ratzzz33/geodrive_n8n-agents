#!/usr/bin/env node

/**
 * Фоновая синхронизация переписок Umnico с мониторингом
 * 
 * Запускает sync_umnico_conversations.mjs в цикле пока есть необработанные чаты
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const BATCH_SIZE = 5; // Размер батча в sync_umnico_conversations.mjs
const DELAY_BETWEEN_BATCHES = 3000; // 3 секунды между батчами
const MAX_ERRORS = 10; // Максимум ошибок подряд перед остановкой

let totalProcessed = 0;
let totalErrors = 0;
let consecutiveErrors = 0;
let startTime = Date.now();

async function getStats() {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    return {
      total: parseInt(stats[0].total),
      processed: parseInt(stats[0].processed),
      pending: parseInt(stats[0].pending)
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return null;
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  } else {
    return `${seconds}с`;
  }
}

function printStatus(stats, batchProcessed, batchErrors) {
  const elapsed = Date.now() - startTime;
  const progress = stats.total > 0 ? ((stats.processed / stats.total) * 100).toFixed(1) : 0;
  const rate = totalProcessed > 0 ? (totalProcessed / (elapsed / 1000 / 60)).toFixed(1) : 0;
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 Статус синхронизации Umnico`);
  console.log('='.repeat(70));
  console.log(`   Всего чатов:     ${stats.total}`);
  console.log(`   Обработано:      ${stats.processed} (${progress}%)`);
  console.log(`   Осталось:        ${stats.pending}`);
  console.log(`   Ошибок:          ${totalErrors}`);
  console.log(`   Время работы:    ${formatTime(elapsed)}`);
  console.log(`   Скорость:        ~${rate} чатов/мин`);
  console.log(`   Последний батч:  ${batchProcessed} успешно, ${batchErrors} ошибок`);
  console.log('='.repeat(70) + '\n');
}

async function runSync() {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, 'sync_umnico_conversations.mjs');
    const child = spawn('node', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Выводим только важные сообщения
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('✅') || line.includes('❌') || line.includes('📋')) {
          console.log(line);
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });
    
    child.on('close', (code) => {
      // Парсим вывод для получения статистики
      const successMatch = stdout.match(/Успешно:\s+(\d+)/);
      const errorsMatch = stdout.match(/Ошибок:\s+(\d+)/);
      
      const batchProcessed = successMatch ? parseInt(successMatch[1]) : 0;
      const batchErrors = errorsMatch ? parseInt(errorsMatch[1]) : 0;
      
      totalProcessed += batchProcessed;
      totalErrors += batchErrors;
      
      if (batchErrors > 0) {
        consecutiveErrors++;
      } else {
        consecutiveErrors = 0;
      }
      
      if (code === 0) {
        resolve({ batchProcessed, batchErrors });
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  console.log('🚀 Запуск фоновой синхронизации Umnico...\n');
  console.log('Нажмите Ctrl+C для остановки\n');
  
  try {
    while (true) {
      // Получаем статистику
      const stats = await getStats();
      if (!stats) {
        console.error('❌ Не удалось получить статистику, жду 10 секунд...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }
      
      // Если все обработано - завершаем
      if (stats.pending === 0) {
        console.log('\n✅ Все чаты обработаны!');
        break;
      }
      
      // Если слишком много ошибок подряд - останавливаемся
      if (consecutiveErrors >= MAX_ERRORS) {
        console.error(`\n❌ Слишком много ошибок подряд (${consecutiveErrors}), останавливаюсь`);
        break;
      }
      
      // Показываем статус
      printStatus(stats, 0, 0);
      
      // Запускаем синхронизацию
      try {
        const result = await runSync();
        printStatus(await getStats(), result.batchProcessed, result.batchErrors);
      } catch (error) {
        console.error(`❌ Ошибка выполнения синхронизации:`, error.message);
        consecutiveErrors++;
        totalErrors++;
      }
      
      // Задержка между батчами
      if (stats.pending > 0) {
        console.log(`⏳ Ожидание ${DELAY_BETWEEN_BATCHES / 1000} секунд перед следующим батчем...\n`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Финальная статистика
    const finalStats = await getStats();
    if (finalStats) {
      const elapsed = Date.now() - startTime;
      console.log('\n' + '='.repeat(70));
      console.log('✅ Синхронизация завершена!');
      console.log('='.repeat(70));
      console.log(`   Всего обработано: ${totalProcessed} чатов`);
      console.log(`   Всего ошибок:     ${totalErrors}`);
      console.log(`   Время работы:     ${formatTime(elapsed)}`);
      console.log(`   Финальный статус: ${finalStats.processed}/${finalStats.total} (${((finalStats.processed / finalStats.total) * 100).toFixed(1)}%)`);
      console.log('='.repeat(70) + '\n');
    }
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

// Обработка Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Получен сигнал остановки, завершаю работу...');
  const stats = await getStats();
  if (stats) {
    printStatus(stats, 0, 0);
  }
  await sql.end();
  process.exit(0);
});

main();

