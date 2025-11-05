import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WF_ID = 'fijJpRlLjgpxSJE7';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function main() {
  console.log('🔄 Реактивация workflow для перерегистрации webhook...\n');

  // Деактивируем
  console.log('1️⃣  Деактивация...');
  const deactivate = await request('POST', `/workflows/${WF_ID}/deactivate`, {});
  console.log(`   Статус: ${deactivate.status}`);
  
  if (deactivate.status !== 200) {
    console.log('   ❌ Ошибка при деактивации');
    console.log(JSON.stringify(deactivate.data, null, 2));
    return 1;
  }
  console.log('   ✅ Деактивирован\n');

  // Ждем 2 секунды
  console.log('2️⃣  Ожидание 2 секунды...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Активируем
  console.log('3️⃣  Активация...');
  const activate = await request('POST', `/workflows/${WF_ID}/activate`, {});
  console.log(`   Статус: ${activate.status}`);
  
  if (activate.status !== 200) {
    console.log('   ❌ Ошибка при активации');
    console.log(JSON.stringify(activate.data, null, 2));
    return 1;
  }
  console.log('   ✅ Активирован\n');

  console.log('═'.repeat(70));
  console.log('\n✅ Webhook перерегистрирован!');
  console.log('\n📌 Workflow: fijJpRlLjgpxSJE7');
  console.log('   URL: https://n8n.rentflow.rentals/workflow/fijJpRlLjgpxSJE7');
  console.log('   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor\n');
  console.log('🧪 Протестируйте снова: node setup/test_booking_501190.mjs');
  console.log('📊 Проверьте в UI что executions появились!');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

