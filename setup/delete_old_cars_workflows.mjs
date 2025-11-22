import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function deleteWorkflow(id) {
  return new Promise((resolve, reject) => {
    const req = https.request('https://n8n.rentflow.rentals/api/v1/workflows/' + id, {
      method: 'DELETE',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          resolve({ success: true, id });
        } else {
          resolve({ success: false, id, error: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const workflowsToDelete = [
  { id: 'K6uhRw5DKNgJyHUY', name: 'Парсинг автомобилей через API раз в час' },
  { id: '6X4g3fn2TkCYKnX3', name: 'Парсинг автомобилей search_cars раз в час' }
];

console.log('🗑️  Удаляю неработающие workflows...\n');

for (const wf of workflowsToDelete) {
  console.log(`   Удаляю: ${wf.name} (${wf.id})...`);
  const result = await deleteWorkflow(wf.id);
  
  if (result.success) {
    console.log(`   ✅ Удален!\n`);
  } else {
    console.log(`   ❌ Ошибка: ${result.error}\n`);
  }
}

console.log('✅ Готово!\n');
console.log('🔧 Остался только workflow для правки:');
console.log('   https://n8n.rentflow.rentals/workflow/u3cOUuoaH5RSw7hm');

