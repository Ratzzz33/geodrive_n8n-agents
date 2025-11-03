// Проверка последних executions от реальных вебхуков
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

console.log('🔍 Анализ последних executions от вебхуков...\n');

try {
  // Получить последние 20 executions
  const response = await fetch(`${N8N_HOST}/executions?workflowId=gNXRKIQpNubEazH7&limit=20`, { headers });
  const data = await response.json();
  
  const executions = data.data || [];
  
  console.log(`📊 Всего executions: ${executions.length}\n`);
  
  // Фильтровать успешные webhook executions
  const webhookExecutions = executions.filter(e => e.mode === 'webhook');
  const successful = webhookExecutions.filter(e => e.status === 'success');
  const failed = webhookExecutions.filter(e => e.status === 'error');
  const running = webhookExecutions.filter(e => !e.finished);
  
  console.log(`📈 Статистика по webhook executions:`);
  console.log(`   ✅ Успешных: ${successful.length}`);
  console.log(`   ❌ Ошибок: ${failed.length}`);
  console.log(`   ⏳ Выполняются: ${running.length}\n`);
  
  // Последние 5 успешных
  if (successful.length > 0) {
    console.log('✅ Последние 5 успешных executions:');
    successful.slice(0, 5).forEach(exec => {
      const date = new Date(exec.startedAt).toLocaleString('ru-RU');
      console.log(`   - ID: ${exec.id}, Время: ${date}`);
    });
    
    // Проверить последний успешный
    const lastSuccess = successful[0];
    console.log(`\n🔍 Детали последнего успешного (ID: ${lastSuccess.id})...`);
    
    const execResponse = await fetch(`${N8N_HOST}/executions/${lastSuccess.id}?includeData=true`, { headers });
    const execData = await execResponse.json();
    
    if (execData.data && execData.data.resultData && execData.data.resultData.runData) {
      const runData = execData.data.resultData.runData;
      
      // Проверить ноду "Save Event"
      if (runData['Save Event']) {
        const saveEvent = runData['Save Event'][0];
        if (saveEvent.error) {
          console.log(`   ❌ Ошибка в Save Event: ${saveEvent.error.message}`);
        } else {
          console.log(`   ✅ Save Event выполнен успешно`);
          if (saveEvent.data && saveEvent.data.main && saveEvent.data.main[0]) {
            const output = saveEvent.data.main[0][0];
            if (output.json && output.json.id) {
              console.log(`   📝 Запись в БД с ID: ${output.json.id}`);
            }
          }
        }
      }
    }
  } else {
    console.log('⚠️  Успешных executions не найдено');
  }
  
  // Последние 3 ошибки
  if (failed.length > 0) {
    console.log(`\n❌ Последние 3 ошибки:`);
    failed.slice(0, 3).forEach(exec => {
      const date = new Date(exec.startedAt).toLocaleString('ru-RU');
      console.log(`   - ID: ${exec.id}, Время: ${date}`);
    });
  }
  
  console.log('\n📋 Рекомендации:');
  if (successful.length === 0 && webhookExecutions.length > 0) {
    console.log('   ⚠️  Вебхуки приходят, но все завершаются с ошибками');
    console.log('   Проверьте детали ошибок в executions выше');
  } else if (successful.length > 0) {
    console.log('   ✅ Вебхуки обрабатываются успешно!');
    console.log('   Проверьте таблицу events в БД для подтверждения');
  } else {
    console.log('   ⚠️  Вебхуки не обрабатываются n8n');
    console.log('   Возможно проблема с маршрутизацией или workflow неактивен');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

