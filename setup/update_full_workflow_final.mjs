import fs from 'fs';
import http from 'http';

const N8N_HOST = 'http://46.224.17.15:5678/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'gNXRKIQpNubEazH7';

const wf = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-webhooks-monitor.json', 'utf8'));
const { id, ...workflowData } = wf;

// Проверка исправлений
const parseNode = workflowData.nodes.find(n => n.name === 'Parse & Validate Format');
const ifNode = workflowData.nodes.find(n => n.name === 'If Known Format');
const code = parseNode.parameters.jsCode;
const ifCondition = ifNode.parameters.conditions.conditions[0].leftValue;

console.log('🔍 Проверка исправлений:');
console.log('  ✅ Явная установка isKnownFormat = false:', code.includes('isKnownFormat = false') ? 'ДА' : 'НЕТ');
console.log('  ✅ Условие If Known Format:', ifCondition === '={{ $json.isKnownFormat === true }}' ? 'ПРАВИЛЬНО' : 'ОШИБКА');

const body = JSON.stringify(workflowData);
const url = new URL(`${N8N_HOST}/workflows/${WORKFLOW_ID}`);

console.log(`\n🔄 Обновление workflow ${WORKFLOW_ID}...`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log(`   Connections: ${Object.keys(workflowData.connections).length}`);

const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: 60000
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Workflow успешно обновлен!');
      try {
        const result = JSON.parse(data);
        console.log(`   Updated: ${result.data?.updatedAt || 'unknown'}`);
      } catch (e) {}
    } else {
      console.error(`❌ Ошибка: ${res.statusCode}`);
      console.error(data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
});

req.write(body);
req.end();

