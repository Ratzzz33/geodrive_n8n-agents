import { readFileSync } from 'fs';
import https from 'https';
import { URL } from 'url';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

// ID старого workflow, который нужно обновить
const OLD_WORKFLOW_ID = 'K9e80NPPxABA4aJy'; // RentProg Monitor - Cash & Events

console.log('📦 Читаем новый workflow из файла...');
const workflowFile = 'n8n-workflows/rentprog-monitor-cash-events-v2.json';
const workflowContent = readFileSync(workflowFile, 'utf-8');
const workflowJson = JSON.parse(workflowContent);

console.log(`✅ Workflow загружен: ${workflowJson.name}`);
console.log(`   Нод: ${workflowJson.nodes.length}`);

// Удаляем системные поля
delete workflowJson.id;
delete workflowJson.versionId;
delete workflowJson.updatedAt;
delete workflowJson.createdAt;

// Формируем тело запроса для обновления
const updateBody = {
  name: workflowJson.name,
  nodes: workflowJson.nodes,
  connections: workflowJson.connections,
  settings: workflowJson.settings
};

const bodyString = JSON.stringify(updateBody);

console.log(`\n🔄 Обновляем workflow ${OLD_WORKFLOW_ID}...`);

const updateUrl = new URL(`${N8N_HOST}/workflows/${OLD_WORKFLOW_ID}`);

const updateOptions = {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyString)
  }
};

const updateReq = https.request(updateUrl, updateOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log('✅ Workflow успешно обновлен!');
      const workflowData = response.data || response;
      console.log(`   ID: ${workflowData.id}`);
      console.log(`   Имя: ${workflowData.name}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowData.id}`);
      
      // Активируем workflow
      console.log('\n🚀 Активируем workflow...');
      const activateUrl = new URL(`${N8N_HOST}/workflows/${workflowData.id}/activate`);
      const activateOptions = {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
      const activateReq = https.request(activateUrl, activateOptions, (activateRes) => {
        let activateData = '';
        activateRes.on('data', chunk => activateData += chunk);
        activateRes.on('end', () => {
          if (activateRes.statusCode === 200) {
            console.log('✅ Workflow активирован!');
          } else {
            console.error('❌ Ошибка активации:', activateData);
          }
        });
      });
      
      activateReq.on('error', (err) => {
        console.error('❌ Ошибка активации:', err.message);
      });
      
      activateReq.end();
      
    } else {
      console.error('❌ Ошибка обновления:', res.statusCode);
      console.error(data);
      process.exit(1);
    }
  });
});

updateReq.on('error', (err) => {
  console.error('❌ Ошибка запроса:', err.message);
  process.exit(1);
});

updateReq.write(bodyString);
updateReq.end();

