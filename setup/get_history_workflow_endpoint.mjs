import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function getWorkflow() {
  return new Promise((resolve, reject) => {
    https.get('https://n8n.rentflow.rentals/api/v1/workflows/xSjwtwrrWUGcBduU', {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

console.log('🔍 Получаю workflow "История операций"...\n');

const wf = await getWorkflow();

// Ищем HTTP Request ноду
const httpNodes = wf.data.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');

console.log(`✅ Найдено HTTP Request нод: ${httpNodes.length}\n`);

httpNodes.forEach((node, i) => {
  console.log(`📡 HTTP Request #${i + 1}: ${node.name}`);
  console.log(`   URL: ${node.parameters.url}`);
  console.log(`   Method: ${node.parameters.method || 'GET'}`);
  
  if (node.parameters.jsonBody) {
    console.log(`   Body:\n${node.parameters.jsonBody}\n`);
  }
  
  console.log('');
});

// Выводим первую ноду полностью
console.log('📋 Полная конфигурация первой ноды:\n');
console.log(JSON.stringify(httpNodes[0].parameters, null, 2));

