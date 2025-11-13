#!/usr/bin/env node
import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const result = await response.json();

console.log('\n📊 Последние 5 executions:\n');

result.data.forEach((exec, idx) => {
  const start = new Date(exec.startedAt);
  const now = new Date();
  const elapsed = Math.round((now - start) / 1000);
  const minutesAgo = Math.round(elapsed / 60);
  
  console.log(`${idx + 1}. ID: ${exec.id}`);
  console.log(`   Время: ${start.toLocaleString('ru-RU')} (${minutesAgo} минут назад)`);
  console.log(`   Статус: ${exec.status}`);
  console.log(`   Завершено: ${exec.finished ? 'Да' : '⚠️ НЕТ - ВЫПОЛНЯЕТСЯ!'}`);
  
  if (exec.stoppedAt) {
    const duration = Math.round((new Date(exec.stoppedAt) - start) / 1000);
    console.log(`   Длительность: ${duration} сек`);
  } else if (!exec.finished) {
    console.log(`   ⏱️ Выполняется уже: ${elapsed} сек`);
  }
  
  console.log('');
});

// Проверяем самое свежее выполнение детально
const latest = result.data[0];
if (!latest.finished) {
  console.log('⚠️ ВЫПОЛНЕНИЕ В ПРОЦЕССЕ! Проверяю детали...\n');
  
  const detailResponse = await fetch(`${N8N_API_URL}/executions/${latest.id}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  const details = await detailResponse.json();
  
  if (details.data && details.data.resultData && details.data.resultData.runData) {
    const runData = details.data.resultData.runData;
    const lastNode = Object.keys(runData).pop();
    
    console.log(`📍 Последняя выполненная нода: ${lastNode}`);
    
    if (lastNode === 'Save to DB') {
      console.log('   🔄 Идет сохранение в БД...');
      console.log('   ⏱️ Это может занять 30-60 секунд для ~2000 записей');
    }
  }
}

console.log(`\n🔗 Открыть последнее: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${latest.id}\n`);
