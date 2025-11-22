#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'UPa1iLM6h958MjQj';

console.log('🚀 Запуск тестового выполнения workflow...');
console.log(`   ID: ${WORKFLOW_ID}`);
console.log(`   Название: ✅Парсинг автомобилей по филиалам раз в час`);

try {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/execute`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  
  console.log('\n✅ Workflow запущен!');
  console.log(`   Execution ID: ${result.data.id}`);
  console.log(`   Status: ${result.data.status}`);
  console.log(`   Started: ${result.data.startedAt}`);
  console.log(`\n🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${result.data.id}`);
  console.log('\n⏳ Ожидание завершения (макс. 60 сек)...');
  
  // Ждем завершения
  let attempts = 0;
  const maxAttempts = 60;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
    
    const statusResponse = await fetch(`${N8N_HOST}/executions/${result.data.id}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    
    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    
    process.stdout.write(`\r   Попытка ${attempts}/${maxAttempts} - Статус: ${status}     `);
    
    if (status === 'success') {
      console.log('\n\n🎉 Workflow выполнен успешно!');
      
      // Получаем детали
      const detailsResponse = await fetch(`${N8N_HOST}/executions/${result.data.id}`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY }
      });
      
      const details = await detailsResponse.json();
      
      if (details.data.data?.resultData?.runData) {
        const formatResult = details.data.data.resultData.runData['Format Result'];
        if (formatResult && formatResult[0]?.data?.main?.[0]?.[0]?.json) {
          const result = formatResult[0].data.main[0][0].json;
          console.log('\n📊 Результаты:');
          console.log(`   Сохранено: ${result.saved_count} автомобилей`);
          console.log(`   Ошибок: ${result.error_count}`);
          console.log('\n   По филиалам:');
          Object.entries(result.by_branch).forEach(([branch, stats]) => {
            console.log(`   ${branch}: ${stats.success} ✓ / ${stats.error} ✗`);
          });
        }
      }
      
      break;
    } else if (status === 'error') {
      console.log('\n\n❌ Workflow завершился с ошибкой!');
      console.log(`   Проверьте: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${result.data.id}`);
      break;
    } else if (status === 'crashed') {
      console.log('\n\n💥 Workflow упал!');
      break;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n\n⏱️ Таймаут ожидания. Workflow все еще выполняется.');
    console.log(`   Проверьте статус: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions/${result.data.id}`);
  }
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}
