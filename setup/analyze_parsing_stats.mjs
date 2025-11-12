#!/usr/bin/env node

import { readFileSync } from 'fs';

const logFile = 'parsing_log_new.txt';
const content = readFileSync(logFile, 'utf8');

// Находим все строки с сохранением
const saveLines = content.match(/✅ Сохранено:.*/g) || [];

let totalWithMessages = 0;
let withNewMessages = 0;
let withOnlyUpdates = 0;
let totalNewMessages = 0;

saveLines.forEach(line => {
  const newMatch = line.match(/\+(\d+) новых/);
  const updateMatch = line.match(/~(\d+) обновлено/);
  
  if (newMatch || updateMatch) {
    totalWithMessages++;
    
    const newCount = newMatch ? parseInt(newMatch[1]) : 0;
    const updateCount = updateMatch ? parseInt(updateMatch[1]) : 0;
    
    if (newCount > 0) {
      withNewMessages++;
      totalNewMessages += newCount;
    } else if (updateCount > 0) {
      withOnlyUpdates++;
    }
  }
});

// Находим существующие диалоги
const existingDialogs = content.match(/📝 Существующий диалог/g) || [];
const newDialogs = content.match(/🆕 Новый диалог/g) || [];

console.log('\n' + '='.repeat(60));
console.log('  АНАЛИЗ СТАТИСТИКИ ПАРСИНГА');
console.log('='.repeat(60) + '\n');

console.log(`Всего обработано диалогов с сообщениями: ${totalWithMessages}`);
console.log(`  - С новыми сообщениями: ${withNewMessages} (${((withNewMessages/totalWithMessages)*100).toFixed(1)}%)`);
console.log(`  - Только обновления (без новых): ${withOnlyUpdates} (${((withOnlyUpdates/totalWithMessages)*100).toFixed(1)}%)`);
console.log(`\nВсего новых сообщений добавлено: ${totalNewMessages}`);

console.log(`\nСуществующие диалоги: ${existingDialogs.length}`);
console.log(`Новые диалоги: ${newDialogs.length}`);

const onlyUpdatesPercent = ((withOnlyUpdates / totalWithMessages) * 100).toFixed(1);

console.log('\n' + '='.repeat(60));
if (onlyUpdatesPercent > 90) {
  console.log('⚠️  ВЫВОД: Большинство диалогов (>90%) имеют только обновления.');
  console.log('   Парсинг, вероятно, уже был выполнен ранее на Hetzner.');
  console.log('   Рекомендуется остановить текущий парсинг.');
} else if (withNewMessages > 0) {
  console.log('✅ ВЫВОД: Обнаружены новые сообщения в диалогах.');
  console.log(`   Добавлено ${totalNewMessages} новых сообщений.`);
  console.log('   Парсинг продолжает находить новые данные.');
} else {
  console.log('ℹ️  ВЫВОД: Все диалоги имеют только обновления.');
  console.log('   Парсинг, вероятно, уже был выполнен ранее.');
}
console.log('='.repeat(60) + '\n');

