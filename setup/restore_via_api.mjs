import fs from 'fs';
import https from 'https';

const N8N_HOST = 'n8n.rentflow.rentals';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const wf = JSON.parse(fs.readFileSync('workflow_for_mcp.json', 'utf8'));
const { id, ...workflowData } = wf;

const payload = JSON.stringify(workflowData);

const options = {
  hostname: N8N_HOST,
  port: 443,
  path: `/api/v1/workflows/${id}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log(`🔄 Восстановление workflow ${id}...`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflowData.connections).length}`);
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Workflow успешно восстановлен!');
      console.log(`📍 URL: https://n8n.rentflow.rentals/workflow/${id}`);
      
      try {
        const response = JSON.parse(data);
        console.log(`\n📊 Восстановлено нод: ${response.nodes?.length || 'N/A'}`);
      } catch (e) {
        // Игнорируем ошибку парсинга
      }
    } else {
      console.error(`❌ Ошибка ${res.statusCode}`);
      console.error(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
});

req.write(payload);
req.end();

