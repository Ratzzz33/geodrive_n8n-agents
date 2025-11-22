/**
 * Проверка формата CSV файла
 */

import fs from 'fs/promises';

async function checkCSV() {
  try {
    // Попытка 1: UTF-16LE (Windows)
    console.log('\n🔍 Попытка 1: UTF-16LE...\n');
    try {
      const content = await fs.readFile('excel/данные_по_авто_1763131843.csv', 'utf16le');
      const lines = content.split('\n').filter(l => l.trim()).slice(0, 3);
      console.log(`Строк: ${lines.length}`);
      for (let i = 0; i < lines.length; i++) {
        console.log(`\nСтрока ${i + 1}:`);
        console.log(lines[i].substring(0, 200));
      }
    } catch (e) {
      console.log('❌ Ошибка:', e.message);
    }
    
    // Попытка 2: UTF-8
    console.log('\n\n🔍 Попытка 2: UTF-8...\n');
    try {
      const content = await fs.readFile('excel/данные_по_авто_1763131843.csv', 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).slice(0, 3);
      console.log(`Строк: ${lines.length}`);
      for (let i = 0; i < lines.length; i++) {
        console.log(`\nСтрока ${i + 1}:`);
        console.log(lines[i].substring(0, 200));
      }
    } catch (e) {
      console.log('❌ Ошибка:', e.message);
    }
    
    // Попытка 3: Windows-1251
    console.log('\n\n🔍 Попытка 3: latin1 (как windows-1251)...\n');
    try {
      const content = await fs.readFile('excel/данные_по_авто_1763131843.csv', 'latin1');
      const lines = content.split('\n').filter(l => l.trim()).slice(0, 3);
      console.log(`Строк: ${lines.length}`);
      for (let i = 0; i < lines.length; i++) {
        console.log(`\nСтрока ${i + 1}:`);
        console.log(lines[i].substring(0, 200));
      }
    } catch (e) {
      console.log('❌ Ошибка:', e.message);
    }
    
    // Попытка 4: Binary
    console.log('\n\n🔍 Попытка 4: Binary (первые байты)...\n');
    const buffer = await fs.readFile('excel/данные_по_авто_1763131843.csv');
    console.log('Первые 50 байтов:', buffer.slice(0, 50));
    console.log('Hex:', buffer.slice(0, 50).toString('hex'));
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  }
}

checkCSV();

