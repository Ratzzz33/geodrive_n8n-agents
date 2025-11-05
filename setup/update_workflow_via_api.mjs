import https from 'https';
import { readFileSync } from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_ID = 'gNXRKIQpNubEazH7';
const WORKFLOW_FILE = 'n8n-workflows/rentprog-webhooks-monitor.json';

console.log('📥 Загрузка workflow из файла...\n');

const workflowContent = readFileSync(WORKFLOW_FILE, 'utf8');
const workflow = JSON.parse(workflowContent);

// Удаляем системные поля
delete workflow.id;
delete workflow.versionId;
delete workflow.updatedAt;
delete workflow.createdAt;
delete workflow.triggerCount;

// Подготовка данных для обновления
const updateData = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings || { executionOrder: 'v1' }
};

const body = JSON.stringify(updateData);

const options = {
  method: 'PUT',
  hostname: 'n8n.rentflow.rentals',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log(`🔄 Обновление workflow ${WORKFLOW_ID}...`);
console.log(`   Нод: ${workflow.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflow.connections).length}\n`);

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const result = JSON.parse(responseData);
      console.log('✅ Workflow успешно обновлен!');
      if (result.data && result.data.id) {
        console.log(`   ID: ${result.data.id}`);
        console.log(`   URL: https://n8n.rentflow.rentals/workflow/${result.data.id}`);
      } else if (result.id) {
        console.log(`   ID: ${result.id}`);
        console.log(`   URL: https://n8n.rentflow.rentals/workflow/${result.id}`);
      }
    } else {
      console.error(`❌ Ошибка: ${res.statusCode}`);
      console.error('Ответ:', responseData);
      try {
        const error = JSON.parse(responseData);
        console.error('Детали:', JSON.stringify(error, null, 2));
      } catch {
        console.error('Текст ошибки:', responseData);
      }
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка запроса:', err.message);
});

req.write(body);
req.end();
