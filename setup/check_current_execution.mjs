#!/usr/bin/env node
/**
 * Проверка текущего/последнего выполнения workflow
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function checkExecution() {
  console.log(`\n🔍 Проверка текущего выполнения...\n`);
  
  // Получаем последнее выполнение
  const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get executions: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  if (!result.data || result.data.length === 0) {
    console.log('❌ Нет выполнений');
    return;
  }
  
  const execution = result.data[0];
  
  const startTime = new Date(execution.startedAt);
  const now = new Date();
  const elapsed = Math.round((now - startTime) / 1000);
  
  console.log(`📋 Execution ID: ${execution.id}`);
  console.log(`⏰ Начало: ${startTime.toLocaleTimeString('ru-RU')}`);
  console.log(`⏱️  Прошло: ${elapsed} секунд`);
  console.log(`📊 Статус: ${execution.status}`);
  console.log(`✅ Завершено: ${execution.finished ? 'Да' : 'НЕТ - ВЫПОЛНЯЕТСЯ'}`);
  
  if (execution.stoppedAt) {
    const duration = Math.round((new Date(execution.stoppedAt) - startTime) / 1000);
    console.log(`⏱️  Длительность: ${duration} секунд`);
  }
  
  // Получаем детали
  console.log(`\n🔗 Ссылка: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${execution.id}\n`);
  
  console.log('📊 Получение деталей выполнения...\n');
  
  const detailResponse = await fetch(`${N8N_API_URL}/executions/${execution.id}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!detailResponse.ok) {
    console.log('⚠️  Не удалось получить детали');
    return;
  }
  
  const details = await detailResponse.json();
  
  if (details.data && details.data.resultData && details.data.resultData.runData) {
    const runData = details.data.resultData.runData;
    
    console.log('📋 Выполненные ноды:\n');
    
    const nodes = [
      'Every 15 Minutes',
      'Get Tbilisi Active',
      'Get Tbilisi Inactive',
      'Get Batumi Active',
      'Get Batumi Inactive',
      'Get Kutaisi Active',
      'Get Kutaisi Inactive',
      'Get Service Active',
      'Get Service Inactive',
      'Merge All Branches',
      'Process All Bookings',
      'Save to DB',
      'Format Result',
      'If Error',
      'Success'
    ];
    
    nodes.forEach(nodeName => {
      if (runData[nodeName]) {
        const nodeRuns = runData[nodeName];
        const lastRun = nodeRuns[nodeRuns.length - 1];
        
        if (lastRun.data && lastRun.data.main && lastRun.data.main[0]) {
          const items = lastRun.data.main[0];
          console.log(`   ✅ ${nodeName.padEnd(25)} ${items.length} items`);
          
          // Для Save to DB показываем результат
          if (nodeName === 'Save to DB' && items.length > 0 && items[0].json) {
            const result = items[0].json;
            console.log(`      → Сохранено: ${result.success_count || result.saved?.length || 0}`);
            console.log(`      → Ошибок: ${result.error_count || result.errors?.length || 0}`);
          }
        } else if (lastRun.error) {
          console.log(`   ❌ ${nodeName.padEnd(25)} ОШИБКА: ${lastRun.error.message}`);
        } else {
          console.log(`   ⏳ ${nodeName.padEnd(25)} выполняется...`);
        }
      } else {
        console.log(`   ⏸️  ${nodeName.padEnd(25)} не запущена`);
      }
    });
    
    // Проверяем ошибки
    if (details.data.resultData.error) {
      console.log(`\n❌ ОШИБКА:`);
      console.log(`   ${details.data.resultData.error.message}`);
      if (details.data.resultData.error.stack) {
        console.log(`\n📜 Stack trace:`);
        console.log(details.data.resultData.error.stack.split('\n').slice(0, 10).join('\n'));
      }
    }
  }
  
  console.log('');
}

checkExecution().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

