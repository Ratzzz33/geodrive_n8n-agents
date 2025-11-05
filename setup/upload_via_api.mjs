import https from 'https';
import fs from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WF_ID = 'fijJpRlLjgpxSJE7';

console.log('📤 Загрузка обновленного workflow в n8n...\n');

// Читаем JSON
const wf = JSON.parse(fs.readFileSync('n8n-workflows/rentprog-upsert-processor-fixed.json', 'utf8'));

console.log('✅ JSON загружен');
console.log(`   Nodes: ${wf.nodes.length}`);
console.log(`   Connections: ${Object.keys(wf.connections).length} узлов\n`);

// Подготавливаем тело запроса (без id - он read-only!)
const body = JSON.stringify({
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings
});

console.log(`📦 Размер payload: ${(body.length / 1024).toFixed(2)} KB\n`);

const url = new URL(`${N8N_HOST}/workflows/${WF_ID}`);

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  },
  rejectUnauthorized: false
};

console.log('🚀 Отправка запроса...\n');

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log(`📥 Статус: ${res.statusCode}\n`);
    
    if (res.statusCode === 200) {
      console.log('✅ Workflow успешно обновлен!\n');
      console.log('═'.repeat(70));
      console.log('\n📋 Изменения:');
      console.log('   1. Endpoint: /bookings/{id} → /search_bookings?query={id}');
      console.log('   2. If Success: проверка массива (Array.isArray && length > 0)');
      console.log('   3. Save Data: первый элемент массива ($json[0].id)\n');
      console.log('💡 Теперь workflow использует SEARCH API!\n');
      console.log('🧪 Протестируйте: node setup/test_booking_501190.mjs');
    } else {
      console.log('❌ Ошибка обновления:\n');
      try {
        const result = JSON.parse(responseData);
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.log(responseData);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
});

req.write(body);
req.end();

