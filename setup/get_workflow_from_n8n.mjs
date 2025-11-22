#!/usr/bin/env node
/**
 * Получение workflow из n8n через REST API
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = process.env.N8N_HOST || 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = process.argv[2] || 'Nc5GFhh5Ikhv1ivK';

async function getWorkflow() {
  console.log(`📥 Получаю workflow ${WORKFLOW_ID} из n8n...\n`);

  try {
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const workflow = await response.json();

    // Проверяем разные варианты структуры ответа
    let workflowData;
    if (workflow.data) {
      workflowData = workflow.data;
    } else if (workflow.id) {
      workflowData = workflow;
    } else {
      console.error('Структура ответа:', JSON.stringify(workflow, null, 2));
      throw new Error('Workflow data not found in response');
    }

    console.log(`✅ Workflow получен: ${workflowData.name}`);
    console.log(`   ID: ${workflowData.id}`);
    console.log(`   Активен: ${workflowData.active ? 'Да' : 'Нет'}`);
    console.log(`   Нод: ${workflowData.nodes?.length || 0}\n`);

    // Сохраняем в файл
    const outputPath = join(__dirname, '..', 'n8n-workflows', `starline-gps-monitor-exported.json`);
    writeFileSync(outputPath, JSON.stringify(workflowData, null, 2), 'utf8');

    console.log(`💾 Workflow сохранен в: ${outputPath}\n`);

    // Выводим краткую информацию
    console.log('📋 Информация о workflow:');
    console.log(`   Название: ${workflowData.name}`);
    console.log(`   Нод: ${workflowData.nodes?.length || 0}`);
    console.log(`   Settings: ${JSON.stringify(workflowData.settings || {}, null, 2)}`);

    return workflowData;

  } catch (error) {
    console.error('❌ Ошибка при получении workflow:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

getWorkflow();

