#!/usr/bin/env node

/**
 * Сохранение 90 диалогов (x=y) в БД
 * Использует существующий скрипт parse_all_umnico_ids.mjs, но только для этих 90 ID
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';

console.log('🔄 Сохранение 90 диалогов в БД через parse_all_umnico_ids.mjs...\n');

// Временно заменяем umnico_chat_ids_full.json на наши 90 ID
const originalFile = 'umnico_chat_ids_full.json';
const backupFile = 'umnico_chat_ids_full.json.backup';
const tempFile = 'umnico_90_dialogs.json';

try {
  // Создаем backup оригинального файла
  if (require('fs').existsSync(originalFile)) {
    require('fs').copyFileSync(originalFile, backupFile);
    console.log(`✅ Создан backup: ${backupFile}`);
  }
  
  // Копируем наш файл с 90 ID
  require('fs').copyFileSync(tempFile, originalFile);
  console.log(`✅ Временно заменен ${originalFile} на ${tempFile}\n`);
  
  // Запускаем существующий скрипт
  console.log('🚀 Запуск parse_all_umnico_ids.mjs...\n');
  const child = spawn('node', ['setup/parse_all_umnico_ids.mjs'], {
    stdio: 'inherit',
    shell: true
  });
  
  child.on('close', (code) => {
    // Восстанавливаем оригинальный файл
    if (require('fs').existsSync(backupFile)) {
      require('fs').copyFileSync(backupFile, originalFile);
      require('fs').unlinkSync(backupFile);
      console.log(`\n✅ Восстановлен оригинальный ${originalFile}`);
    }
    
    if (code === 0) {
      console.log('\n✅ Все диалоги успешно сохранены в БД!');
    } else {
      console.log(`\n❌ Скрипт завершился с кодом ${code}`);
    }
    process.exit(code);
  });
  
} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
}

