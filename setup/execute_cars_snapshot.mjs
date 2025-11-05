import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'j7UEBJvTzjhHrzR4';

console.log('🚀 Запуск workflow "RentProg Cars Snapshot"...');
console.log(`   ID: ${WORKFLOW_ID}\n`);

const options = {
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}/execute`, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ Workflow успешно запущен!');
        console.log(`   Execution ID: ${json.data?.id || 'N/A'}`);
        console.log(`   Status: ${json.data?.status || 'running'}`);
        console.log(`\n⏱️  Ожидаемое время выполнения: 5-15 минут`);
        console.log(`\n📊 Отслеживайте выполнение:`);
        console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions`);
        console.log(`\n💡 Или используйте скрипт:`);
        console.log(`   node setup/check_execution.mjs ${json.data?.id || ''}`);
      } else {
        console.error(`❌ Ошибка ${res.statusCode}:`, json.message || data);
      }
    } catch (e) {
      console.error('❌ Ошибка парсинга ответа:', data);
    }
  });
});

req.on('error', err => {
  console.error('❌ Ошибка запроса:', err.message);
  process.exit(1);
});

req.end();

