#!/usr/bin/env node

/**
 * Мониторинг процесса парсинга Umnico в реальном времени
 */

import { readFileSync, existsSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const LOG_FILE = 'parsing_log_new.txt';
const FALLBACK_LOG = 'parsing_log.txt';
const TOTAL_IDS = 1917;
const UPDATE_INTERVAL = 3000; // 3 секунды

// ANSI цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function getLogFile() {
  if (existsSync(LOG_FILE)) return LOG_FILE;
  if (existsSync(FALLBACK_LOG)) return FALLBACK_LOG;
  return null;
}

function getLastLines(file, count = 20) {
  try {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-count);
  } catch (e) {
    return [];
  }
}

function extractProgress(logLines) {
  // Ищем последний обработанный диалог: [123/1917]
  const progressMatch = logLines
    .map(line => line.match(/\[(\d+)\/1917\]/))
    .filter(m => m)
    .pop();
  
  const lastProcessed = progressMatch ? parseInt(progressMatch[1]) : 0;
  
  // Ищем статистику
  const stats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    messagesAdded: 0,
    messagesUpdated: 0,
    incomplete: 0,
  };
  
  // Пытаемся найти итоговую статистику
  const finalStatsMatch = logLines.find(line => line.includes('ИТОГОВАЯ СТАТИСТИКА'));
  if (finalStatsMatch) {
    const statsSection = logLines.slice(logLines.indexOf(finalStatsMatch));
    stats.processed = parseInt(statsSection.find(l => l.includes('Успешно обработано'))?.match(/\d+/) || [0])[0];
    stats.failed = parseInt(statsSection.find(l => l.includes('Ошибок'))?.match(/\d+/) || [0])[0];
    stats.skipped = parseInt(statsSection.find(l => l.includes('Пропущено'))?.match(/\d+/) || [0])[0];
    stats.messagesAdded = parseInt(statsSection.find(l => l.includes('добавлено сообщений'))?.match(/\d+/) || [0])[0];
    stats.messagesUpdated = parseInt(statsSection.find(l => l.includes('обновлено сообщений'))?.match(/\d+/) || [0])[0];
    stats.incomplete = parseInt(statsSection.find(l => l.includes('Неполных диалогов'))?.match(/\d+/) || [0])[0];
  }
  
  return { lastProcessed, stats };
}

async function getDbStats() {
  try {
    const [conv] = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN metadata->>'incomplete' = 'true' THEN 1 END)::int as incomplete
      FROM conversations
      WHERE umnico_conversation_id IS NOT NULL
    `;
    
    const [msg] = await sql`SELECT COUNT(*)::int as total FROM messages`;
    const [clients] = await sql`SELECT COUNT(*)::int as total FROM clients`;
    
    return {
      conversations: conv.total,
      incomplete: conv.incomplete,
      messages: msg.total,
      clients: clients.total,
    };
  } catch (e) {
    return null;
  }
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

function formatProgress(current, total) {
  const percent = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
  const barWidth = 40;
  const filled = Math.floor((current / total) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  return `${bar} ${percent}% (${current}/${total})`;
}

async function displayStatus() {
  const logFile = getLogFile();
  const logLines = logFile ? getLastLines(logFile, 50) : [];
  const { lastProcessed, stats } = extractProgress(logLines);
  const dbStats = await getDbStats();
  
  clearScreen();
  
  console.log(colors.bright + colors.cyan + '='.repeat(70));
  console.log('  📊 МОНИТОРИНГ ПАРСИНГА UMNICO ДИАЛОГОВ');
  console.log('='.repeat(70) + colors.reset);
  console.log();
  
  // Прогресс
  console.log(colors.bright + '📈 ПРОГРЕСС:' + colors.reset);
  console.log(`   ${formatProgress(lastProcessed, TOTAL_IDS)}`);
  console.log();
  
  // Статистика из БД
  if (dbStats) {
    console.log(colors.bright + '💾 БАЗА ДАННЫХ:' + colors.reset);
    console.log(`   💬 Диалоги: ${colors.green}${dbStats.conversations}${colors.reset} (${colors.yellow}${dbStats.incomplete} неполных${colors.reset})`);
    console.log(`   📨 Сообщения: ${colors.green}${dbStats.messages}${colors.reset}`);
    console.log(`   👥 Клиенты: ${colors.green}${dbStats.clients}${colors.reset}`);
    console.log();
  }
  
  // Статистика из лога (если есть)
  if (stats.processed > 0 || stats.failed > 0) {
    console.log(colors.bright + '📋 СТАТИСТИКА ИЗ ЛОГА:' + colors.reset);
    if (stats.processed > 0) console.log(`   ✅ Обработано: ${colors.green}${stats.processed}${colors.reset}`);
    if (stats.failed > 0) console.log(`   ❌ Ошибок: ${colors.red}${stats.failed}${colors.reset}`);
    if (stats.skipped > 0) console.log(`   ⏭️  Пропущено: ${colors.yellow}${stats.skipped}${colors.reset}`);
    if (stats.messagesAdded > 0) console.log(`   📨 Добавлено сообщений: ${colors.green}${stats.messagesAdded}${colors.reset}`);
    if (stats.messagesUpdated > 0) console.log(`   📝 Обновлено сообщений: ${colors.blue}${stats.messagesUpdated}${colors.reset}`);
    if (stats.incomplete > 0) console.log(`   ⚠️  Неполных диалогов: ${colors.yellow}${stats.incomplete}${colors.reset}`);
    console.log();
  }
  
  // Последние строки лога
  if (logLines.length > 0) {
    console.log(colors.bright + '📝 ПОСЛЕДНИЕ СОБЫТИЯ:' + colors.reset);
    const recentLines = logLines.slice(-10);
    recentLines.forEach(line => {
      if (line.includes('✅')) {
        console.log(`   ${colors.green}${line}${colors.reset}`);
      } else if (line.includes('❌') || line.includes('Ошибка')) {
        console.log(`   ${colors.red}${line}${colors.reset}`);
      } else if (line.includes('⚠️')) {
        console.log(`   ${colors.yellow}${line}${colors.reset}`);
      } else if (line.includes('🔍')) {
        console.log(`   ${colors.cyan}${line}${colors.reset}`);
      } else {
        console.log(`   ${line}`);
      }
    });
  } else {
    console.log(colors.yellow + '   ⚠️  Лог-файл не найден или пуст' + colors.reset);
  }
  
  console.log();
  console.log(colors.bright + colors.cyan + '='.repeat(70));
  console.log(`  Обновление каждые ${UPDATE_INTERVAL / 1000} сек. | Нажмите Ctrl+C для выхода`);
  console.log('='.repeat(70) + colors.reset);
}

// Основной цикл
let isRunning = true;

process.on('SIGINT', () => {
  isRunning = false;
  console.log('\n\n' + colors.yellow + '⏹️  Мониторинг остановлен' + colors.reset);
  sql.end().then(() => process.exit(0));
});

async function main() {
  console.log(colors.bright + colors.cyan + '\n🚀 Запуск мониторинга парсинга...\n' + colors.reset);
  
  while (isRunning) {
    try {
      await displayStatus();
      await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL));
    } catch (error) {
      console.error(colors.red + '❌ Ошибка:', error.message + colors.reset);
      await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL));
    }
  }
}

main().catch(async (error) => {
  console.error(colors.red + '❌ Критическая ошибка:', error + colors.reset);
  await sql.end();
  process.exit(1);
});

