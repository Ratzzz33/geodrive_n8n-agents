#!/usr/bin/env node
import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('\n🔍 Проверка running executions...\n');

// Проверяем executions со статусом running
const runningResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&status=running&limit=10`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const running = await runningResponse.json();

console.log(`📊 Running executions: ${running.data?.length || 0}\n`);

if (running.data && running.data.length > 0) {
  running.data.forEach((exec, idx) => {
    const start = new Date(exec.startedAt);
    const elapsed = Math.round((Date.now() - start) / 1000);
    
    console.log(`${idx + 1}. ID: ${exec.id}`);
    console.log(`   Начало: ${start.toLocaleString('ru-RU')}`);
    console.log(`   ⏱️ Выполняется: ${elapsed} сек (${Math.round(elapsed / 60)} мин)`);
    console.log(`   🔗 https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${exec.id}\n`);
  });
} else {
  console.log('✅ Нет активных executions\n');
  console.log('💡 Возможные причины:');
  console.log('   1. Execution завершился (успешно или с ошибкой)');
  console.log('   2. Execution был отменен');
  console.log('   3. Workflow не запущен\n');
  
  // Проверяем последние завершенные
  console.log('📋 Последние завершенные executions:\n');
  
  const allResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=3`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  const all = await allResponse.json();
  
  all.data.forEach((exec, idx) => {
    const start = new Date(exec.startedAt);
    const ago = Math.round((Date.now() - start) / 60000);
    
    console.log(`${idx + 1}. ID: ${exec.id} (${ago} мин назад)`);
    console.log(`   Статус: ${exec.status}`);
    console.log(`   Finished: ${exec.finished}`);
    
    if (exec.stoppedAt) {
      const duration = Math.round((new Date(exec.stoppedAt) - start) / 1000);
      console.log(`   Длительность: ${duration} сек`);
    }
    
    console.log('');
  });
}

