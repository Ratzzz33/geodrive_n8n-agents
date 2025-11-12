import { readFileSync } from 'fs';

const log = readFileSync('parsing_log_new.txt', 'utf8');

// Находим все ID диалогов, где было "total неизвестен"
const dialogMatches = log.matchAll(/🔍 \[(\d+)\/1917\] Диалог ID: (\d+)[\s\S]*?total неизвестен/g);

const ids = new Set();
for (const match of dialogMatches) {
  const dialogId = match[2];
  ids.add(dialogId);
}

const idsArray = Array.from(ids).sort((a, b) => parseInt(a) - parseInt(b));

console.log('\n=== ДИАЛОГИ С "total неизвестен" (возможно x=y) ===\n');
console.log(`Найдено: ${idsArray.length} уникальных диалогов\n`);

if (idsArray.length > 0) {
  console.log('📋 Список ID:');
  console.log(idsArray.join(', '));
  
  console.log(`\n📊 Всего ID: ${idsArray.length}`);
  
  // Разбиваем на группы по 20 для удобства
  console.log('\n📦 Группами по 20:');
  for (let i = 0; i < idsArray.length; i += 20) {
    const group = idsArray.slice(i, i + 20);
    console.log(`\nГруппа ${Math.floor(i/20) + 1}:`);
    console.log(group.join(', '));
  }
}

