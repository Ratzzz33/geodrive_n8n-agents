#!/usr/bin/env node
/**
 * Импорт workflow "Restore Cars from RentProg (Scheduled)" в n8n
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_FILE = join(__dirname, '..', 'n8n-workflows', 'restore-cars-scheduled.json');

async function importWorkflow() {
  try {
    console.log('📥 Импорт workflow "Restore Cars from RentProg (Scheduled)"...\n');

    // Читаем workflow файл
    const wfContent = readFileSync(WORKFLOW_FILE, 'utf-8');
    const wfJson = JSON.parse(wfContent);

    // Удаляем системные поля
    delete wfJson.id;
    delete wfJson.versionId;
    delete wfJson.updatedAt;
    delete wfJson.createdAt;
    delete wfJson.triggerCount;
    delete wfJson.staticData;

    // Подготавливаем данные для API
    const workflowData = {
      name: wfJson.name,
      nodes: wfJson.nodes,
      connections: wfJson.connections,
      settings: wfJson.settings || { executionOrder: 'v1' }
    };

    // Отправляем запрос
    const response = await fetch(`${N8N_HOST}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const workflowId = result.data?.id || result.id;

    if (!workflowId) {
      throw new Error('Workflow ID not found in response');
    }

    console.log('✅ Workflow успешно создан!');
    console.log(`   ID: ${workflowId}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
    console.log('\n⚠️  ВАЖНО:');
    console.log('   1. Проверьте credentials для Telegram в workflow');
    console.log('   2. Активируйте workflow вручную через UI');
    console.log('   3. Убедитесь, что Jarvis API запущен на сервере');

  } catch (error) {
    console.error('❌ Ошибка при импорте workflow:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

importWorkflow();

