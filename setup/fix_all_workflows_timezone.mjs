#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_DIRS = [
  path.join(__dirname, '../n8n-workflows'),
  path.join(__dirname, '../setup') // Проверим и setup, там бывают workflow файлы
];

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  console.log(`\n📂 Сканирую директорию: ${dir}`);
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Пропускаем файлы execution логов (они большие и их не надо править)
      if (file.includes('execution_') || file.includes('log')) continue;

      // Пробуем распарсить JSON
      let json;
      try {
        json = JSON.parse(content);
      } catch (e) {
        // Не валидный JSON, пропускаем
        continue;
      }

      // Проверяем, похоже ли это на n8n workflow
      // Должны быть nodes и connections
      if (!json.nodes || !json.connections) {
        continue;
      }

      let changed = false;

      // Проверяем settings
      if (!json.settings) {
        json.settings = {};
        changed = true;
      }

      // Проверяем timezone
      if (json.settings.timezone !== 'Asia/Tbilisi') {
        console.log(`   🔧 Исправление Timezone в файле: ${file}`);
        if (json.settings.timezone) {
          console.log(`      Было: ${json.settings.timezone}`);
        } else {
          console.log(`      Было: не установлено`);
        }
        
        json.settings.timezone = 'Asia/Tbilisi';
        
        // Также добавляем saveExecutionProgress для надежности, если нет
        if (json.settings.saveExecutionProgress === undefined) {
          json.settings.saveExecutionProgress = true;
        }
        
        changed = true;
      }
      
      // Если изменили - сохраняем
      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
        console.log(`      ✅ Сохранено`);
      }

    } catch (error) {
      console.error(`❌ Ошибка обработки файла ${file}: ${error.message}`);
    }
  }
}

console.log('🌍 Глобальная установка Timezone = Asia/Tbilisi для всех Workflow\n');

for (const dir of WORKFLOW_DIRS) {
  processDirectory(dir);
}

console.log('\n✅ Готово');

