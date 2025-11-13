#!/usr/bin/env node
/**
 * Подготовка workflow для полного импорта броней
 * Согласно .cursorrules:
 * - Удаляем date filter для полного импорта
 * - Увеличиваем timeout до 2 часов
 * - Проверяем retry механизм
 */

import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function getWorkflow() {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data || data;
}

async function updateWorkflow(workflow) {
  // Согласно .cursorrules: только name, nodes, connections, settings
  const updateData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update workflow: ${response.status}\n${error}`);
  }
  
  return await response.json();
}

async function main() {
  console.log('='.repeat(70));
  console.log('ПОДГОТОВКА WORKFLOW ДЛЯ ПОЛНОГО ИМПОРТА БРОНЕЙ');
  console.log('='.repeat(70));
  console.log(`Workflow ID: ${WORKFLOW_ID}\n`);
  
  // 1. Получить workflow
  console.log('1. Получаю текущий workflow...');
  const workflow = await getWorkflow();
  console.log(`   ✓ Получен: "${workflow.name}"`);
  console.log(`   ✓ Нод: ${workflow.nodes.length}`);
  console.log(`   ✓ Active: ${workflow.active}`);
  
  // 2. Найти HTTP Request ноды и удалить date filter
  console.log('\n2. Обрабатываю HTTP Request ноды...');
  let updatedCount = 0;
  
  for (const node of workflow.nodes) {
    if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters.jsonBody) {
      const body = node.parameters.jsonBody.replace(/^=/, '');
      const parsed = JSON.parse(body);
      
      // Удаляем filters
      if (parsed.filters) {
        console.log(`   - ${node.name}: удаляю filters`);
        delete parsed.filters;
        node.parameters.jsonBody = `=${JSON.stringify(parsed)}`;
        updatedCount++;
      }
      
      // Увеличиваем per_page для быстрого импорта
      if (parsed.per_page && parsed.per_page < 100) {
        console.log(`   - ${node.name}: per_page ${parsed.per_page} → 100`);
        parsed.per_page = 100;
        node.parameters.jsonBody = `=${JSON.stringify(parsed)}`;
        updatedCount++;
      }
      
      // Проверяем retry (согласно best practices)
      if (!node.retryOnFail) {
        console.log(`   - ${node.name}: добавляю retry механизм`);
        node.retryOnFail = true;
        node.maxTries = 2;
        node.continueOnFail = true;
        updatedCount++;
      }
    }
  }
  
  console.log(`   ✓ Обновлено нод: ${updatedCount}`);
  
  // 3. Увеличить timeout в settings
  console.log('\n3. Обновляю settings...');
  if (!workflow.settings) {
    workflow.settings = {};
  }
  
  // Timeout 2 часа = 7200 секунд
  const newTimeout = 7200;
  workflow.settings.executionTimeout = newTimeout;
  workflow.settings.saveExecutionProgress = true;
  workflow.settings.saveDataSuccessExecution = 'all';
  console.log(`   ✓ executionTimeout: ${newTimeout}s (2 часа)`);
  console.log(`   ✓ saveExecutionProgress: true`);
  console.log(`   ✓ saveDataSuccessExecution: all`);
  
  // 4. Обновить workflow
  console.log('\n4. Сохраняю изменения...');
  await updateWorkflow(workflow);
  console.log('   ✓ Workflow обновлён!');
  
  console.log('\n' + '='.repeat(70));
  console.log('ГОТОВО К ЗАПУСКУ');
  console.log('='.repeat(70));
  console.log('\nСледующий шаг:');
  console.log('  Запусти workflow вручную через n8n UI:');
  console.log(`  https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\nОжидаемое время выполнения: 30-60 минут');
  console.log('Мониторинг: https://n8n.rentflow.rentals/executions');
}

main().catch(err => {
  console.error('\n❌ ОШИБКА:', err.message);
  process.exit(1);
});

