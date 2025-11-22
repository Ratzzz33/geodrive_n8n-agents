import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function getExecution(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://n8n.rentflow.rentals/api/v1/executions/${id}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

console.log('🔍 Получаю execution 12960...\n');

const exec = await getExecution('12960');

console.log(`📊 Execution: ${exec.data.workflowId}`);
console.log(`   Status: ${exec.data.status}`);
console.log(`   Started: ${exec.data.startedAt}`);
console.log(`   Finished: ${exec.data.finishedAt || 'running'}\n`);

// Смотрим результаты нод
Object.keys(exec.data.data.resultData.runData).forEach(nodeName => {
  const nodeData = exec.data.data.resultData.runData[nodeName];
  console.log(`📦 ${nodeName}:`);
  
  nodeData.forEach((run, i) => {
    if (run.data && run.data.main && run.data.main[0]) {
      const items = run.data.main[0];
      console.log(`   Run ${i + 1}: ${items.length} items`);
      
      // Показываем первые 2 записи
      items.slice(0, 2).forEach((item, idx) => {
        console.log(`   Item ${idx + 1}:`, JSON.stringify(item.json, null, 2).substring(0, 200));
      });
    }
  });
  console.log('');
});

// Проверяем есть ли ошибки
if (exec.data.data.resultData.error) {
  console.log('❌ ОШИБКА:', exec.data.data.resultData.error);
}
