#!/usr/bin/env node

import { readFileSync } from 'fs';
import postgres from 'postgres';

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // Читаем файл
    const fileContent = readFileSync('umnico_chat_ids_full.json', 'utf-8');
    const data = JSON.parse(fileContent);
    const idsInFile = data.ids || [];
    
    console.log('📊 Проверка количества ID:\n');
    console.log(`   В файле umnico_chat_ids_full.json:`);
    console.log(`   - Поле "total": ${data.total}`);
    console.log(`   - Реальное количество в массиве "ids": ${idsInFile.length}`);
    
    // Проверяем БД
    const dbStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processed = TRUE) as processed,
        COUNT(*) FILTER (WHERE processed = FALSE) as pending
      FROM umnico_chat_ids
    `;
    
    console.log(`\n   В БД (таблица umnico_chat_ids):`);
    console.log(`   - Всего ID: ${dbStats[0].total}`);
    console.log(`   - Обработано: ${dbStats[0].processed}`);
    console.log(`   - Ожидает обработки: ${dbStats[0].pending}`);
    
    // Проверяем, все ли ID из файла есть в БД
    const idsInDb = await sql`
      SELECT id FROM umnico_chat_ids
    `;
    const dbIdsSet = new Set(idsInDb.map(r => r.id));
    
    const missing = idsInFile.filter(id => !dbIdsSet.has(String(id)));
    const extra = Array.from(dbIdsSet).filter(id => !idsInFile.includes(id));
    
    console.log(`\n   Сравнение:`);
    if (missing.length === 0 && extra.length === 0) {
      console.log(`   ✅ Все ID из файла есть в БД`);
    } else {
      if (missing.length > 0) {
        console.log(`   ⚠️  Отсутствуют в БД: ${missing.length} ID`);
        if (missing.length <= 10) {
          console.log(`      ${missing.join(', ')}`);
        } else {
          console.log(`      ${missing.slice(0, 10).join(', ')} ... и еще ${missing.length - 10}`);
        }
      }
      if (extra.length > 0) {
        console.log(`   ℹ️  Есть в БД, но нет в файле: ${extra.length} ID`);
      }
    }
    
    console.log(`\n   Итого:`);
    console.log(`   - В файле: ${idsInFile.length} уникальных ID`);
    console.log(`   - В БД: ${dbStats[0].total} ID`);
    
    if (idsInFile.length === parseInt(dbStats[0].total)) {
      console.log(`   ✅ Количество совпадает!`);
    } else {
      console.log(`   ⚠️  Расхождение: ${Math.abs(idsInFile.length - parseInt(dbStats[0].total))} ID`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

check().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

