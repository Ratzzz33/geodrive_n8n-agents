#!/usr/bin/env node
/**
 * Быстрый деплой исправления body structure на production
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка .env
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
  console.log('✅ .env файл загружен\n');
} catch (error) {
  console.log('⚠️  .env файл не найден\n');
}

import { spawn } from 'child_process';

function runSSH(command) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Выполняю: ${command}\n`);
    
    const ssh = spawn('python', ['setup/server_ssh.py', command], {
      stdio: 'inherit',
      shell: true
    });
    
    ssh.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SSH команда завершилась с кодом ${code}`));
      }
    });
    
    ssh.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Деплой: обработка странной структуры body от n8n      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  try {
    // 1. Git pull
    console.log('📥 Шаг 1/4: Обновление кода...\n');
    await runSSH('cd /root/geodrive_n8n-agents && git pull');
    
    // 2. npm install (на всякий случай)
    console.log('\n📦 Шаг 2/4: Установка зависимостей...\n');
    await runSSH('cd /root/geodrive_n8n-agents && npm install');
    
    // 3. Build
    console.log('\n🔨 Шаг 3/4: Сборка TypeScript...\n');
    await runSSH('cd /root/geodrive_n8n-agents && npm run build');
    
    // 4. Restart jarvis-api
    console.log('\n🔄 Шаг 4/4: Перезапуск jarvis-api...\n');
    await runSSH('cd /root/geodrive_n8n-agents && docker compose restart jarvis-api');
    
    // 5. Health check
    console.log('\n🏥 Проверка health...\n');
    await runSSH('sleep 5 && curl -s http://localhost:3000/health | jq .');
    
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ ДЕПЛОЙ ЗАВЕРШЁН!                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Что изменилось:');
    console.log('   • /upsert-car теперь обрабатывает body[""]');
    console.log('   • /upsert-client теперь обрабатывает body[""]');
    console.log('   • Поддержка обоих форматов: обычный и странный от n8n\n');
    
    console.log('🧪 Рекомендуемый тест:');
    console.log('   Повторить execution #4329 (booking_update)');
    console.log('   и проверить, что "Upsert Car HTTP" теперь работает\n');
    
  } catch (error) {
    console.error('\n❌ Ошибка деплоя:', error.message);
    process.exit(1);
  }
}

main();

