#!/usr/bin/env node
/**
 * Проверка последнего выполнения workflow
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function checkLastExecution() {
  console.log(`\n🔍 Проверка последнего выполнения...\n`);
  
  // Получаем список executions
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
    console.log('❌ Нет выполнений workflow');
    return;
  }
  
  const execution = result.data[0];
  
  console.log(`📋 Последнее выполнение:`);
  console.log(`   ID: ${execution.id}`);
  console.log(`   Статус: ${execution.finished ? '✅' : '⏳'} ${execution.status}`);
  console.log(`   Время: ${execution.startedAt}`);
  console.log(`   Длительность: ${execution.stoppedAt ? Math.round((new Date(execution.stoppedAt) - new Date(execution.startedAt)) / 1000) + 's' : 'выполняется...'}`);
  
  // Получаем детали выполнения
  const detailResponse = await fetch(`${N8N_API_URL}/executions/${execution.id}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!detailResponse.ok) {
    console.log('\n⚠️  Не удалось получить детали выполнения');
    return;
  }
  
  const details = await detailResponse.json();
  
  if (details.data && details.data.resultData && details.data.resultData.runData) {
    const runData = details.data.resultData.runData;
    
    console.log(`\n📊 Результаты нод:`);
    
    // Проверяем ключевые ноды
    const nodesToCheck = [
      'Merge All Branches',
      'Process All Bookings',
      'Save to DB',
      'Format Result'
    ];
    
    nodesToCheck.forEach(nodeName => {
      if (runData[nodeName]) {
        const nodeRuns = runData[nodeName];
        const lastRun = nodeRuns[nodeRuns.length - 1];
        
        if (lastRun.data && lastRun.data.main && lastRun.data.main[0]) {
          const items = lastRun.data.main[0];
          console.log(`   ${nodeName}: ${items.length} items`);
          
          // Для Save to DB показываем детали
          if (nodeName === 'Save to DB' && items.length > 0) {
            const firstItem = items[0].json;
            if (firstItem.id) {
              console.log(`      → Сохранено успешно! (id: ${firstItem.id})`);
            }
            if (items.length > 3) {
              console.log(`      → ... и еще ${items.length - 1} записей`);
            }
          }
          
          // Для Format Result показываем сообщение
          if (nodeName === 'Format Result' && items.length > 0) {
            const msg = items[0].json;
            if (msg.error_count !== undefined) {
              console.log(`      → Ошибок: ${msg.error_count}`);
              console.log(`      → Всего: ${msg.stats?.total || 0}`);
            }
          }
        } else {
          console.log(`   ${nodeName}: ❌ нет данных`);
        }
      } else {
        console.log(`   ${nodeName}: ⚠️  не выполнялась`);
      }
    });
    
    // Проверяем ошибки
    if (details.data.resultData.error) {
      console.log(`\n❌ Ошибка выполнения:`);
      console.log(`   ${details.data.resultData.error.message}`);
    }
  }
  
  console.log(`\n🔗 Ссылка: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${execution.id}\n`);
}

checkLastExecution().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

