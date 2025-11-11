#!/usr/bin/env node
/**
 * Импорт workflow "Парсинг активных броней раз в час"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

async function importWorkflow() {
  console.log('📥 Импорт workflow из файла...\n');

  // Читаем файл workflow
  const workflowFile = path.join(__dirname, '..', 'n8n-workflows', 'active-bookings-hourly-sync-simple.json');
  const workflowContent = fs.readFileSync(workflowFile, 'utf8');
  const workflowJson = JSON.parse(workflowContent);

  // Удаляем системные поля
  delete workflowJson.id;
  delete workflowJson.versionId;
  delete workflowJson.updatedAt;
  delete workflowJson.createdAt;
  delete workflowJson.triggerCount;

  // Создаем минимальный объект для импорта
  const workflow = {
    name: workflowJson.name,
    nodes: workflowJson.nodes,
    connections: workflowJson.connections,
    settings: workflowJson.settings || { executionOrder: 'v1', timezone: 'Asia/Tbilisi' }
  };

  console.log(`📋 Workflow: ${workflow.name}`);
  console.log(`   Нод: ${workflow.nodes.length}`);
  console.log(`   Настройки: ${JSON.stringify(workflow.settings)}\n`);

  try {
    const response = await fetch(`${N8N_HOST}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflow)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${error.substring(0, 500)}`);
    }

    const result = await response.json();
    const createdWorkflow = result.data || result;
    
    console.log('✅ Workflow создан успешно!');
    console.log(`   ID: ${createdWorkflow.id}`);
    console.log(`   Name: ${createdWorkflow.name}`);
    console.log(`   Active: ${createdWorkflow.active}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${createdWorkflow.id}\n`);

    return createdWorkflow;
  } catch (error) {
    console.error(`❌ Ошибка импорта: ${error.message}`);
    throw error;
  }
}

importWorkflow().catch(err => {
  console.error('\n❌ Критическая ошибка:', err.message);
  process.exit(1);
});

