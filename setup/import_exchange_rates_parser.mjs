#!/usr/bin/env node
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import 'dotenv/config';

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function importWorkflow() {
  try {
    console.log('📦 Импорт workflow "RentProg Exchange Rates Parser"...\n');
    
    // Читаем workflow файл
    const wfContent = readFileSync('n8n-workflows/rentprog-exchange-rates-parser.json', 'utf8');
    const wfJson = JSON.parse(wfContent);
    
    // Удаляем служебные поля
    delete wfJson.id;
    delete wfJson.versionId;
    delete wfJson.updatedAt;
    delete wfJson.createdAt;
    
    const headers = {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    };
    
    // Создаём workflow
    const response = await fetch(`${N8N_HOST}/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(wfJson),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const result = await response.json();
    const workflowId = result.data?.id || result.id;
    
    console.log('✅ Workflow создан!');
    console.log(`   ID: ${workflowId}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
    console.log('\nНастройки:');
    console.log('   🕐 Запуск: каждый час');
    console.log('   🏢 Филиал: Tbilisi');
    console.log('   💱 Парсинг: GEL ↔ USD, EUR, RUB');
    console.log('   💾 Сохранение: таблица exchange_rates\n');
    
    // Активируем workflow
    console.log('⚙️  Активация workflow...');
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers,
    });
    
    if (activateResponse.ok) {
      console.log('✅ Workflow активирован!\n');
    } else {
      console.log('⚠️  Активируйте workflow вручную через UI\n');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

importWorkflow();

