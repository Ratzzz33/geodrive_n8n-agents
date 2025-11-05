import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WEBHOOK_WORKFLOW_ID = 'gNXRKIQpNubEazH7';

console.log('🔍 Проверка последних выполнений webhook workflow...\n');

const options = {
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
};

https.get(`${N8N_HOST}/executions?workflowId=${WEBHOOK_WORKFLOW_ID}&limit=5`, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const executions = json.data || [];
      
      console.log(`📊 Найдено выполнений: ${executions.length}\n`);
      
      executions.forEach((exec, idx) => {
        const status = exec.status || exec.finished ? '✅ Success' : exec.stoppedAt ? '❌ Error' : '⏳ Running';
        const startTime = new Date(exec.startedAt).toLocaleTimeString('ru-RU');
        const duration = exec.stoppedAt 
          ? Math.round((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000) 
          : 'running';
        
        console.log(`${idx + 1}. ${status}`);
        console.log(`   ID: ${exec.id}`);
        console.log(`   Начало: ${startTime}`);
        console.log(`   Длительность: ${duration}s`);
        console.log(`   Mode: ${exec.mode || 'webhook'}`);
        
        // Показываем детали если есть
        if (exec.data) {
          console.log(`   📝 Есть данные выполнения`);
        }
        console.log('');
      });
      
      if (executions.length > 0) {
        const lastExecId = executions[0].id;
        console.log(`💡 Для детального анализа последнего выполнения:`);
        console.log(`   node setup/analyze_execution.mjs ${lastExecId}`);
      }
      
    } catch (e) {
      console.error('❌ Ошибка парсинга:', e.message);
      console.log('Ответ:', data);
    }
  });
}).on('error', err => {
  console.error('❌ Ошибка запроса:', err.message);
});
