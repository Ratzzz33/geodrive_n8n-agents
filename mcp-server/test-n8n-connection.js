#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки подключения к n8n
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка переменных окружения
const envPath = join(__dirname, '..', '.env');
let N8N_BASE_URL = process.env.N8N_BASE_URL || process.env.N8N_URL || 'http://46.224.17.15:5678';
let N8N_API_KEY = process.env.N8N_API_KEY || '';

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'N8N_BASE_URL' || key === 'N8N_URL') {
        N8N_BASE_URL = value || N8N_BASE_URL;
      }
      if (key === 'N8N_API_KEY') {
        N8N_API_KEY = value || N8N_API_KEY;
      }
    }
  });
} catch (e) {
  console.log('⚠️  Файл .env не найден, используем переменные окружения');
}

const n8nApiUrl = N8N_BASE_URL.replace(/\/$/, '').replace(/\/api\/v1$/, '') + '/api/v1';

console.log('🔍 Проверка подключения к n8n...\n');
console.log(`URL: ${n8nApiUrl}`);
console.log(`API Key: ${N8N_API_KEY ? '✅ Настроен (' + N8N_API_KEY.substring(0, 20) + '...)' : '❌ НЕ настроен'}\n`);

if (!N8N_API_KEY) {
  console.error('❌ Ошибка: N8N_API_KEY не настроен!');
  console.error('\nДобавьте в .env файл:');
  console.error('N8N_BASE_URL=https://n8n.rentflow.rentals');
  console.error('N8N_API_KEY=ваш_api_ключ');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('📡 Отправка запроса к n8n API...');
    const response = await axios.get(`${n8nApiUrl}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const workflows = response.data?.data || [];
    console.log(`\n✅ Подключение успешно!`);
    console.log(`📊 Найдено workflows: ${workflows.length}\n`);

    if (workflows.length > 0) {
      console.log('Первые 5 workflows:');
      workflows.slice(0, 5).forEach((wf) => {
        console.log(`  - ${wf.name} (ID: ${wf.id}, Active: ${wf.active ? '✅' : '❌'})`);
      });
    }

    return true;
  } catch (error) {
    if (error.response) {
      console.error(`\n❌ Ошибка HTTP ${error.response.status}:`);
      console.error(`   ${error.response.data?.message || JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`\n❌ Ошибка подключения:`);
      console.error(`   Не удалось подключиться к ${n8nApiUrl}`);
      console.error(`   Проверьте доступность домена и SSL сертификат`);
    } else {
      console.error(`\n❌ Ошибка: ${error.message}`);
    }
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});

