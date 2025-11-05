import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'fijJpRlLjgpxSJE7';

console.log('\n📋 Проверка executions для Upsert Processor...\n');

const options = {
  hostname: 'n8n.rentflow.rentals',
  port: 443,
  path: `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=5&includeData=true`,
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    
    if (data.data && data.data.executions) {
      const execs = data.data.executions;
      console.log(`✅ Найдено executions: ${execs.length}\n`);
      
      if (execs.length > 0) {
        execs.forEach((exec, i) => {
          console.log(`${i + 1}. ID: ${exec.id}`);
          console.log(`   Статус: ${exec.status}`);
          console.log(`   Время: ${exec.startedAt}`);
          console.log(`   Длительность: ${exec.stoppedAt ? new Date(exec.stoppedAt) - new Date(exec.startedAt) + 'ms' : 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('❌ Нет executions!');
        console.log('\n💡 Возможные причины:');
        console.log('   1. Webhook не зарегистрирован (деактивируйте и активируйте workflow)');
        console.log('   2. Путь webhook неправильный');
        console.log('   3. Запросы идут на другой workflow\n');
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Ошибка: ${e.message}\n`);
});

req.end();

