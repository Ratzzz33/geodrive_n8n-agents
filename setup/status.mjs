#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require', {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

const TOTAL = 1917;
const logFile = existsSync('parsing_log_new.txt') ? 'parsing_log_new.txt' : (existsSync('parsing_log.txt') ? 'parsing_log.txt' : null);

let processed = 0;
if (logFile) {
  try {
    const content = readFileSync(logFile, 'utf8');
    const matches = content.match(/\[(\d+)\/1917\]/g);
    if (matches && matches.length > 0) {
      processed = parseInt(matches[matches.length - 1].match(/\d+/)[0]);
    }
  } catch (e) {}
}

const [conv] = await sql`SELECT COUNT(*)::int as t, COUNT(CASE WHEN metadata->>'incomplete'='true' THEN 1 END)::int as i FROM conversations WHERE umnico_conversation_id IS NOT NULL`;
const [msg] = await sql`SELECT COUNT(*)::int as t FROM messages`;
const [clients] = await sql`SELECT COUNT(*)::int as t FROM clients`;

const progress = ((processed / TOTAL) * 100).toFixed(1);
const barWidth = 40;
const filled = Math.floor((processed / TOTAL) * barWidth);
const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

console.log('\n' + '='.repeat(60));
console.log('  МОНИТОРИНГ ПАРСИНГА UMNICO');
console.log('='.repeat(60) + '\n');
console.log(`Прогресс: ${bar} ${progress}% (${processed}/${TOTAL})\n`);
console.log('База данных:');
console.log(`  Диалоги: ${conv.t} (${conv.i} неполных)`);
console.log(`  Сообщения: ${msg.t}`);
console.log(`  Клиенты: ${clients.t}\n`);

if (logFile) {
  try {
    const lines = readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-5);
    console.log('Последние события:');
    lastLines.forEach(line => {
      if (line.includes('✅')) console.log(`  ${line}`);
      else if (line.includes('❌')) console.log(`  ${line}`);
      else if (line.includes('⚠️')) console.log(`  ${line}`);
      else if (line.includes('🔍')) console.log(`  ${line}`);
      else console.log(`  ${line}`);
    });
  } catch (e) {}
}

console.log('\n' + '='.repeat(60) + '\n');

await sql.end();

