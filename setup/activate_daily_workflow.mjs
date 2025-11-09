import https from 'https';
import { URL } from 'url';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = '8jkfmWF2dTtnlMHj';

console.log(`🚀 Активируем workflow ${WORKFLOW_ID}...`);

const activateUrl = new URL(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`);

const options = {
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
};

const req = https.request(activateUrl, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Workflow активирован!');
      const response = JSON.parse(data);
      console.log(`   Имя: ${response.data.name}`);
      console.log(`   Статус: ${response.data.active ? 'ACTIVE' : 'INACTIVE'}`);
    } else {
      console.error('❌ Ошибка:', res.statusCode);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка запроса:', err.message);
  process.exit(1);
});

req.end();

