#!/usr/bin/env node
/**
 * Создание нового workflow "Парсинг активных броней раз в час"
 * с чистой структурой без проблемных полей
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

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

async function createNewWorkflow() {
  console.log('🆕 Создание нового workflow...\n');

  // Читаем чистый файл
  const workflowFile = join(__dirname, '..', 'n8n-workflows', 'active-bookings-hourly-sync-clean.json');
  const workflowData = JSON.parse(readFileSync(workflowFile, 'utf8'));

  // Меняем имя на оригинальное (без NEW)
  workflowData.name = 'Парсинг активных броней раз в час';

  console.log(`   Название: ${workflowData.name}`);
  console.log(`   Нод: ${workflowData.nodes.length}`);
  console.log('   💾 Создаю workflow...');

  const createResponse = await n8nRequest('POST', '/workflows', workflowData);

  if (createResponse.statusCode >= 200 && createResponse.statusCode < 300) {
    const workflowId = createResponse.data.data?.id || createResponse.data.id;
    console.log(`   ✅ Workflow создан!`);
    console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}\n`);
    return { id: workflowId, success: true };
  } else {
    throw new Error(`Ошибка создания: ${createResponse.statusCode}\n${JSON.stringify(createResponse.data, null, 2)}`);
  }
}

createNewWorkflow()
  .then(result => {
    console.log(`✅ Новый workflow создан успешно!`);
    console.log(`🔗 Откройте: https://n8n.rentflow.rentals/workflow/${result.id}`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Ошибка:`, error.message);
    process.exit(1);
  });

