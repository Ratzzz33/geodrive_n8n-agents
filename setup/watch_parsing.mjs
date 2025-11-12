#!/usr/bin/env node

/**
 * Простой мониторинг парсинга (Windows-совместимый)
 */

import { readFileSync, existsSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(CONNECTION_STRING, { max: 1, ssl: { rejectUnauthorized: false } });

const LOG_FILE = 'parsing_log_new.txt';
const FALLBACK_LOG = 'parsing_log.txt';
const TOTAL_IDS = 1917;

function getLogFile() {
  if (existsSync(LOG_FILE)) return LOG_FILE;
  if (existsSync(FALLBACK_LOG)) return FALLBACK_LOG;
  return null;
}

function getLastProcessed(logFile) {
  try {
    const content = readFileSync(logFile, 'utf8');
    const matches = content.match(/\[(\d+)\/1917\]/g);
    if (!matches || matches.length === 0) return 0;
    const lastMatch = matches[matches.length - 1];
    const num = parseInt(lastMatch.match(/\d+/)[0]);
    return num;
  } catch (e) {
    return 0;
  }
}

async function showStatus() {
  const logFile = getLogFile();
  const processed = logFile ? getLastProcessed(logFile) : 0;
  const progress = ((processed / TOTAL_IDS) * 100).toFixed(1);
  
  let dbStats = null;
  try {
    const [conv] = await sql`SELECT COUNT(*)::int as total, COUNT(CASE WHEN metadata->>'incomplete' = 'true' THEN 1 END)::int as incomplete FROM conversations WHERE umnico_conversation_id IS NOT NULL`;
    const [msg] = await sql`SELECT COUNT(*)::int as total FROM messages`;
    dbStats = { conversations: conv.total, incomplete: conv.incomplete, messages: msg.total };
  } catch (e) {
    // ignore
  }
  
  console.log('\n========================================');
  console.log('  МОНИТОРИНГ ПАРСИНГА UMNICO');
  console.log('========================================\n');
  console.log(`Прогресс: ${processed}/${TOTAL_IDS} (${progress}%)`);
  
  if (dbStats) {
    console.log(`\nБаза данных:`);
    console.log(`  Диалоги: ${dbStats.conversations} (${dbStats.incomplete} неполных)`);
    console.log(`  Сообщения: ${dbStats.messages}`);
  }
  
  if (logFile) {
    try {
      const content = readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const lastLines = lines.slice(-5);
      console.log(`\nПоследние события:`);
      lastLines.forEach(line => console.log(`  ${line}`));
    } catch (e) {
      console.log(`\nЛог-файл: ${logFile}`);
    }
  } else {
    console.log('\nЛог-файл не найден');
  }
  
  console.log('\n========================================\n');
}

// Основной цикл
let running = true;
process.on('SIGINT', () => {
  running = false;
  console.log('\nОстановка мониторинга...');
  sql.end().then(() => process.exit(0));
});

async function main() {
  console.log('Запуск мониторинга (Ctrl+C для выхода)...\n');
  
  while (running) {
    await showStatus();
    await new Promise(r => setTimeout(r, 5000)); // 5 секунд
  }
}

main().catch(async (e) => {
  console.error('Ошибка:', e.message);
  await sql.end();
  process.exit(1);
});

