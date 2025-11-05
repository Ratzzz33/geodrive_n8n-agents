import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'SLW5V3xUSKsyVYGE';

const url = new URL(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_API_KEY
  },
  rejectUnauthorized: false
};

console.log('🔄 Активация Fixed Upsert Processor...\n');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Workflow активирован!');
      console.log(`   ID: ${WORKFLOW_ID}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
    } else {
      console.log(`❌ Ошибка: ${res.statusCode}`);
      console.log(`   Ответ: ${responseData}\n`);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});

req.write('{}');
req.end();

