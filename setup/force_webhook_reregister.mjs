import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'fijJpRlLjgpxSJE7';

console.log('\n🔄 Принудительная перерегистрация webhook...\n');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'n8n.rentflow.rentals',
      port: 443,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  // 1. Деактивация
  console.log('1️⃣  Деактивация workflow...');
  await apiRequest('POST', `/workflows/${WORKFLOW_ID}/deactivate`);
  console.log('   ✅ Деактивирован\n');

  // Пауза 2 секунды
  await new Promise(r => setTimeout(r, 2000));

  // 2. Активация
  console.log('2️⃣  Активация workflow...');
  await apiRequest('POST', `/workflows/${WORKFLOW_ID}/activate`);
  console.log('   ✅ Активирован\n');

  console.log('✅ Webhook перерегистрирован!');
  console.log('\n📍 Webhook URL: https://n8n.rentflow.rentals/webhook/upsert-processor');
  console.log('🧪 Тестируйте сейчас!\n');
}

main().catch(console.error);

