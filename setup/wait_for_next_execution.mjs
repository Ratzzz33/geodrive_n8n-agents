#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'xSjwtwrrWUGcBduU';

async function waitForExecution() {
  console.log('🕐 Ожидаю следующий execution (максимум 3 минуты)...\n');
  
  const startTime = Date.now();
  const timeout = 3 * 60 * 1000; // 3 минуты
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`https://n8n.rentflow.rentals/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY
        }
      });
      
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const latest = data.data[0];
        
        // Проверяем, что это недавний execution (после нашего фикса)
        const executionTime = new Date(latest.startedAt).getTime();
        if (executionTime > startTime) {
          console.log(`\n📊 Новый Execution #${latest.id}:`);
          console.log('   Status:', latest.status);
          console.log('   Started:', latest.startedAt);
          console.log('   Stopped:', latest.stoppedAt);
          
          if (latest.status === 'success') {
            console.log('\n✅ Workflow работает! Проблема решена.');
            process.exit(0);
          } else if (latest.status === 'error') {
            console.log('\n❌ Все еще ошибка. Нужна дополнительная диагностика.');
            console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID + '/executions/' + latest.id);
            process.exit(1);
          }
        }
      }
      
      // Ждем 5 секунд перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stdout.write(`\r⏱️  Проверка... (${elapsed}s / 180s)`);
      
    } catch (error) {
      console.error('\n❌ Ошибка при проверке:', error.message);
    }
  }
  
  console.log('\n\n⏱️ Timeout: новых executions не найдено за 3 минуты');
  console.log('Проверьте вручную: https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
  process.exit(2);
}

waitForExecution();

