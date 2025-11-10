#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'j6yLX6GZcE9t5ZcO';
const workflowPath = path.join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json');

async function importWorkflow() {
  try {
    console.log('📥 Импорт упрощенного workflow в n8n\n');

    // Читаем workflow
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflowJson = JSON.parse(workflowContent);

    // Удаляем системные поля
    delete workflowJson.id;
    delete workflowJson.versionId;
    delete workflowJson.updatedAt;
    delete workflowJson.createdAt;

    // Подготавливаем payload для обновления
    const updatePayload = {
      name: workflowJson.name,
      nodes: workflowJson.nodes,
      connections: workflowJson.connections,
      settings: workflowJson.settings || { executionOrder: 'v1' }
    };

    // Обновляем workflow
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Workflow успешно обновлен!');
    
    // n8n API может вернуть данные в разных форматах
    const workflowData = result.data || result;
    if (workflowData) {
      console.log(`   ID: ${workflowData.id || WORKFLOW_ID}`);
      console.log(`   Название: ${workflowData.name || workflowJson.name}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowData.id || WORKFLOW_ID}`);
    } else {
      console.log(`   ID: ${WORKFLOW_ID}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    }
    console.log('\n📋 Изменения:');
    console.log('   - Убрано сохранение в БД (Upsert Snapshot, Generate SQL Updates, Apply Updates)');
    console.log('   - Добавлен узел "Get Cars from DB" для получения данных из БД');
    console.log('   - Заменен "Compute Diff (SQL)" на "Compare API vs DB" (Code node)');
    console.log('   - Изменен "Prepare Updates" → "Prepare Report" (только отчет)');
    console.log('   - Workflow теперь только сравнивает и отправляет уведомления');
    console.log('\n💡 Для обновления БД используйте скрипт: restore_cars_from_rentprog.mjs');

  } catch (error) {
    console.error('❌ Ошибка при импорте:', error.message);
    process.exit(1);
  }
}

importWorkflow();

