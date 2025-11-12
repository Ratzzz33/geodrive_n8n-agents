#!/usr/bin/env node
/**
 * Обновление workflow "Парсинг активных броней раз в час"
 * Исправляет структуру согласно правилам 2025 года
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'GMKZJpL9mF1iMEGV';

function n8nRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: { error: body } });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function updateWorkflow() {
  console.log('🔄 Обновление workflow "Парсинг активных броней раз в час"...\n');

  // Читаем исправленный файл
  const workflowFile = join(__dirname, '..', 'n8n-workflows', 'active-bookings-hourly-sync.json');
  const workflowData = JSON.parse(readFileSync(workflowFile, 'utf8'));

  // Получаем текущий workflow для сохранения credentials
  console.log('   📥 Получаю текущий workflow...');
  const currentResponse = await n8nRequest('GET', `/workflows/${WORKFLOW_ID}`);
  
  if (currentResponse.statusCode !== 200) {
    throw new Error(`Ошибка получения workflow: ${currentResponse.statusCode}`);
  }

  const currentWorkflow = currentResponse.data.data;
  const currentNodes = currentWorkflow.nodes || [];

  // Восстанавливаем credentials из существующих нод
  workflowData.nodes = workflowData.nodes.map(node => {
    const existingNode = currentNodes.find(n => n.name === node.name && n.type === node.type);
    if (existingNode && existingNode.credentials) {
      node.credentials = existingNode.credentials;
    }
    return node;
  });

  // Обновляем settings - убираем errorWorkflow если он ссылается на несуществующий workflow
  const updatedSettings = {
    ...workflowData.settings,
    timezone: 'Asia/Tbilisi',
    executionOrder: 'v1'
  };
  
  // Удаляем errorWorkflow если он есть (может ссылаться на несуществующий workflow)
  if (currentWorkflow.settings?.errorWorkflow) {
    console.log('   ⚠️  Удаляю ссылку на errorWorkflow (может вызывать ошибки)');
    delete updatedSettings.errorWorkflow;
  }

  workflowData.settings = updatedSettings;

  // Обновляем workflow
  console.log('   💾 Обновляю workflow...');
  const updateResponse = await n8nRequest('PUT', `/workflows/${WORKFLOW_ID}`, workflowData);

  if (updateResponse.statusCode >= 200 && updateResponse.statusCode < 300) {
    console.log(`   ✅ Workflow успешно обновлен!`);
    console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
    return { success: true };
  } else {
    throw new Error(`Ошибка обновления: ${updateResponse.statusCode}\n${JSON.stringify(updateResponse.data, null, 2)}`);
  }
}

updateWorkflow()
  .then(() => {
    console.log('✅ Обновление завершено успешно!');
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Ошибка:`, error.message);
    process.exit(1);
  });

