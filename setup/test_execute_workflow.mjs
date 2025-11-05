import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'j7UEBJvTzjhHrzR4';

console.log('🚀 Запуск workflow "RentProg Cars Snapshot" (тестовое выполнение)...\n');

const payload = JSON.stringify({
  workflowData: {
    id: WORKFLOW_ID
  }
});

const options = {
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

// Попробуем разные endpoints
const endpoints = [
  `/workflows/${WORKFLOW_ID}/run`,
  `/workflows/${WORKFLOW_ID}/test`,
  `/executions/test/${WORKFLOW_ID}`
];

async function tryEndpoint(endpoint) {
  return new Promise((resolve) => {
    console.log(`Пробую: ${endpoint}`);
    
    const req = https.request(`${N8N_HOST}${endpoint}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Успешно! Статус: ${res.statusCode}`);
          try {
            const json = JSON.parse(data);
            console.log('Ответ:', JSON.stringify(json, null, 2));
            resolve(true);
          } catch (e) {
            console.log('Ответ (текст):', data);
            resolve(true);
          }
        } else {
          console.log(`❌ Статус ${res.statusCode}: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Ошибка: ${err.message}`);
      resolve(false);
    });
    
    req.write(payload);
    req.end();
  });
}

(async () => {
  for (const endpoint of endpoints) {
    const success = await tryEndpoint(endpoint);
    if (success) {
      console.log('\n🎉 Workflow запущен!');
      return;
    }
    console.log('');
  }
  
  console.log('\n💡 Альтернатива: Запустите вручную через UI');
  console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('   Нажмите кнопку "Test workflow" или "Execute Workflow"');
})();

