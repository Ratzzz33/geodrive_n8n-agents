// Получить сырые данные из последнего webhook execution
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const executionId = process.argv[2] || '63';

console.log(`🔍 Получение сырых данных из execution ${executionId}...\n`);

try {
  const response = await fetch(`${N8N_HOST}/executions/${executionId}?includeData=true`, { headers });
  const result = await response.json();
  
  const exec = result;
  
  if (!exec) {
    console.log('❌ Execution не найден');
    process.exit(1);
  }
  
  console.log(`📊 Execution ID: ${exec.id}`);
  console.log(`   Статус: ${exec.status}`);
  console.log(`   Время: ${new Date(exec.startedAt).toLocaleString('ru-RU')}\n`);
  
  // Получить данные из Webhook ноды
  const executionData = exec.data;
  
  if (executionData && executionData.resultData && executionData.resultData.runData) {
    const runData = executionData.resultData.runData;
    
    if (runData['Webhook']) {
      console.log('📥 Данные из ноды Webhook:');
      const webhookData = runData['Webhook'][0];
      
      if (webhookData.data && webhookData.data.main && webhookData.data.main[0]) {
        const rawData = webhookData.data.main[0][0];
        console.log('\n🔍 Сырые данные запроса:');
        console.log(JSON.stringify(rawData, null, 2));
        
        // Анализ структуры
        console.log('\n📋 Структура данных:');
        console.log(`   query: ${JSON.stringify(rawData.json?.query || {})}`);
        console.log(`   body: ${JSON.stringify(rawData.json?.body || {}, null, 2)}`);
        console.log(`   headers: ${rawData.json?.headers ? 'есть' : 'нет'}`);
        console.log(`   params: ${JSON.stringify(rawData.json?.params || {})}`);
      }
    } else {
      console.log('⚠️  Нода Webhook не найдена');
    }
    
    // Проверить ноду "Debug: Webhook Received" - там должно быть полное сообщение
    if (runData['Debug: Webhook Received']) {
      console.log('\n📨 Данные из Debug ноды:');
      const debugData = runData['Debug: Webhook Received'][0];
      if (debugData.data && debugData.data.main && debugData.data.main[0]) {
        const debugOutput = debugData.data.main[0][0];
        console.log(JSON.stringify(debugOutput, null, 2));
      }
    }
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

