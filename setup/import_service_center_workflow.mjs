import https from 'https';
import fs from 'fs';

const N8N_HOST = 'n8n.rentflow.rentals';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('\n📦 Импорт Service Center Processor в n8n...\n');

// Читаем workflow файл
const workflowPath = 'n8n-workflows/service-center-processor.json';
const workflowContent = fs.readFileSync(workflowPath, 'utf8');
const workflow = JSON.parse(workflowContent);

// Подготавливаем данные для создания
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
  path: '/api/v1/workflows',
  method: 'POST',
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
    if (res.statusCode === 200 || res.statusCode === 201) {
      const response = JSON.parse(body);
      const workflowId = response.data?.id || response.id;
      
      console.log('✅ Workflow успешно импортирован!\n');
      console.log(`📋 ID: ${workflowId}`);
      console.log(`📛 Name: ${workflow.name}`);
      console.log(`🔗 URL: https://${N8N_HOST}/workflow/${workflowId}\n`);
      
      console.log('📍 Webhook URL:');
      console.log(`   https://${N8N_HOST}/webhook/service-center-webhook\n`);
      
      console.log('⚙️  Настройте этот URL в RentProg для филиала Service Center!\n');
      
      // Активируем workflow
      console.log('🔄 Активация workflow...\n');
      
      const activateOptions = {
        hostname: N8N_HOST,
        port: 443,
        path: `/api/v1/workflows/${workflowId}/activate`,
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
      const activateReq = https.request(activateOptions, (activateRes) => {
        let activateBody = '';
        activateRes.on('data', chunk => activateBody += chunk);
        activateRes.on('end', () => {
          if (activateRes.statusCode === 200) {
            console.log('✅ Workflow активирован!\n');
          } else {
            console.log('⚠️  Не удалось активировать автоматически');
            console.log('   Активируйте вручную через UI\n');
          }
        });
      });
      
      activateReq.on('error', (e) => {
        console.log('⚠️  Ошибка активации:', e.message, '\n');
      });
      
      activateReq.end();
      
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


