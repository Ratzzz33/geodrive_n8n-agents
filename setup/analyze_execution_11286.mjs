#!/usr/bin/env node
import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const EXECUTION_ID = '11286';

async function main() {
  console.log('='.repeat(80));
  console.log(`АНАЛИЗ EXECUTION #${EXECUTION_ID}`);
  console.log('='.repeat(80));
  
  const response = await fetch(`${N8N_HOST}/executions/${EXECUTION_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    console.log(`❌ Не удалось получить execution: ${response.status}`);
    return;
  }
  
  const data = await response.json();
  const execution = data.data || data;
  
  console.log(`\nStatus: ${execution.status}`);
  console.log(`Started: ${execution.startedAt}`);
  console.log(`Stopped: ${execution.stoppedAt || 'N/A'}`);
  console.log(`Mode: ${execution.mode}`);
  console.log(`Workflow ID: ${execution.workflowId}`);
  
  // Анализ нод
  const runData = execution.data?.resultData?.runData || {};
  const nodeNames = Object.keys(runData);
  
  console.log('\n' + '='.repeat(80));
  console.log('ВЫПОЛНЕННЫЕ НОДЫ:');
  console.log('='.repeat(80));
  
  nodeNames.forEach(nodeName => {
    const runs = runData[nodeName];
    if (!runs || runs.length === 0) return;
    
    const lastRun = runs[runs.length - 1];
    const data = lastRun.data?.main?.[0] || [];
    const error = lastRun.error;
    
    console.log(`\n📦 ${nodeName}`);
    console.log(`   Items: ${data.length}`);
    
    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success`);
    }
    
    // Для Process All Bookings - показать примеры
    if (nodeName === 'Process All Bookings' && data.length > 0) {
      console.log(`\n   📝 Примеры данных (первые 3):`);
      data.slice(0, 3).forEach((item, i) => {
        const json = item.json;
        console.log(`\n   ${i+1}. branch: "${json.branch || 'NULL'}"`);
        console.log(`      number: "${json.number || 'NULL'}"`);
        console.log(`      booking_id: "${json.booking_id || 'NULL'}"`);
        console.log(`      client_name: "${json.client_name || 'NULL'}"`);
        console.log(`      is_active: ${json.is_active}`);
      });
    }
    
    // Для Save to DB - показать результат
    if (nodeName === 'Save to DB' && data.length > 0) {
      console.log(`\n   💾 Результат сохранения:`);
      data.slice(0, 3).forEach((item, i) => {
        const json = item.json;
        console.log(`\n   ${i+1}.`, JSON.stringify(json, null, 2).substring(0, 200));
      });
    }
  });
  
  // Проверка на ошибки
  console.log('\n' + '='.repeat(80));
  console.log('ОШИБКИ:');
  console.log('='.repeat(80));
  
  let hasErrors = false;
  nodeNames.forEach(nodeName => {
    const runs = runData[nodeName];
    if (!runs || runs.length === 0) return;
    
    const lastRun = runs[runs.length - 1];
    if (lastRun.error) {
      hasErrors = true;
      console.log(`\n❌ ${nodeName}:`);
      console.log(`   ${lastRun.error.message}`);
      if (lastRun.error.description) {
        console.log(`   ${lastRun.error.description}`);
      }
    }
  });
  
  if (!hasErrors) {
    console.log('\n✅ Ошибок не обнаружено');
  }
  
  // Итог
  console.log('\n' + '='.repeat(80));
  console.log('ИТОГ:');
  console.log('='.repeat(80));
  
  if (runData['Process All Bookings']) {
    const processedItems = runData['Process All Bookings'][0]?.data?.main?.[0]?.length || 0;
    console.log(`\nProcess All Bookings обработал: ${processedItems} items`);
  }
  
  if (runData['Save to DB']) {
    const savedItems = runData['Save to DB'][0]?.data?.main?.[0]?.length || 0;
    console.log(`Save to DB обработал: ${savedItems} items`);
  }
  
  console.log(`\nСтатус execution: ${execution.status}`);
}

main().catch(console.error);

