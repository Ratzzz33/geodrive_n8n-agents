#!/usr/bin/env node
/**
 * Деплой исправления для извлечения conversationId в Playwright Service
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

console.log('🚀 Деплой исправления Playwright Service\n');

// 1. Проверяем изменения
console.log('📝 Проверка изменений...');
try {
  const status = execSync('git status --porcelain services/playwright-umnico.ts', { encoding: 'utf-8' });
  if (status.trim()) {
    console.log('✅ Обнаружены изменения в playwright-umnico.ts\n');
  } else {
    console.log('⚠️  Изменений не обнаружено\n');
  }
} catch (error) {
  console.log('⚠️  Git не доступен, продолжаем...\n');
}

// 2. Инструкции для деплоя
console.log('📋 Инструкции для деплоя на сервере:\n');
console.log('1. Подключиться к серверу:');
console.log('   ssh root@46.224.17.15\n');
console.log('2. Перейти в директорию проекта:');
console.log('   cd /root/geodrive_n8n-agents\n');
console.log('3. Обновить код:');
console.log('   git pull\n');
console.log('4. Пересобрать Playwright Service:');
console.log('   cd services');
console.log('   npm run build  # или npx tsc playwright-umnico.ts --outDir dist --module commonjs --target es2020 --esModuleInterop');
console.log('   cd ..\n');
console.log('5. Пересобрать Docker образ:');
console.log('   docker compose build playwright-umnico\n');
console.log('6. Перезапустить контейнер:');
console.log('   docker compose restart playwright-umnico\n');
console.log('7. Проверить логи:');
console.log('   docker logs playwright-umnico --tail 50 -f\n');
console.log('================================\n');
console.log('Или использовать автоматический деплой через deploy_fixes_now.py\n');

