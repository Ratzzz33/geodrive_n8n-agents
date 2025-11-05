import https from 'https';
import fs from 'fs';

const N8N_HOST = 'n8n.rentflow.rentals';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

console.log('\n🔧 Обновление Service Center Processor...\n');

// Читаем workflow файл
const workflowPath = 'n8n-workflows/service-center-processor.json';
const workflowContent = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(workflowContent);

// Подготавливаем данные для обновления (без id - read-only)
const workflowData = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings || { executionOrder: 'v1' }
};

const payload = JSON.stringify(workflowData);

const options = {
  hostname: N8N_HOST,
  port: 443,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  
  res.on('data', chunk => body += chunk);
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Workflow успешно обновлён!\n');
      console.log(`📋 ID: ${WORKFLOW_ID}`);
      console.log(`📛 Name: ${workflow.name}`);
      console.log(`🔗 URL: https://${N8N_HOST}/workflow/${WORKFLOW_ID}\n`);
      
      console.log('✅ Исправлено:');
      console.log('   - Fetch Car: authentication = "none" ✓');
      console.log('   - Fetch Client: authentication = "none" ✓');
      console.log('   - Fetch Booking: authentication = "none" ✓');
      console.log('   - Authorization header передаётся динамически ✓\n');
      
      console.log('💡 Токен берётся из Get RentProg Token node');
      console.log('   и передаётся через Authorization header\n');
      
    } else {
      console.error('❌ Ошибка:', res.statusCode);
      console.error(body);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message);
});

req.write(payload);
req.end();

