#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'UPa1iLM6h958MjQj';

console.log('📋 Проверка статуса workflow...');

try {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const wf = data.data;
  
  console.log('\n✅ Workflow найден:');
  console.log(`   ID: ${wf.id}`);
  console.log(`   Название: ${wf.name}`);
  console.log(`   Активен: ${wf.active ? '✅ ДА' : '❌ НЕТ'}`);
  console.log(`   Нод: ${wf.nodes.length}`);
  console.log(`   Создан: ${wf.createdAt}`);
  console.log(`   Обновлен: ${wf.updatedAt}`);
  console.log(`\n🔗 URL: https://n8n.rentflow.rentals/workflow/${wf.id}`);
  
  // Проверяем последние executions
  console.log('\n📊 Проверка последних запусков...');
  
  const execResponse = await fetch(`${N8N_HOST}/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  const execData = await execResponse.json();
  
  if (execData.data.results && execData.data.results.length > 0) {
    console.log(`\n   Найдено ${execData.data.results.length} запусков:`);
    execData.data.results.forEach(ex => {
      console.log(`   - ${ex.startedAt}: ${ex.status} (ID: ${ex.id})`);
    });
  } else {
    console.log('   ℹ️  Запусков еще не было');
    console.log('\n💡 Workflow можно запустить вручную через UI:');
    console.log(`   1. Откройте: https://n8n.rentflow.rentals/workflow/${wf.id}`);
    console.log(`   2. Нажмите кнопку "Execute workflow"`);
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

