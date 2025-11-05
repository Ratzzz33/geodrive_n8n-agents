import https from 'https';

const N8N_HOST = 'n8n.rentflow.rentals';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

function makeRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: N8N_HOST,
      port: 443,
      path: path,
      method: method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      const payload = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null });
        } else {
          reject(new Error(`${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function reregisterWebhook() {
  console.log('\n🔄 Перерегистрация webhook...\n');
  
  try {
    // 1. Деактивация
    console.log('1️⃣ Деактивация workflow...');
    await makeRequest(`/api/v1/workflows/${WORKFLOW_ID}/deactivate`, 'POST');
    console.log('   ✅ Деактивирован\n');
    
    // Пауза
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Активация
    console.log('2️⃣ Активация workflow...');
    await makeRequest(`/api/v1/workflows/${WORKFLOW_ID}/activate`, 'POST');
    console.log('   ✅ Активирован\n');
    
    console.log('✅ Webhook перерегистрирован!\n');
    console.log('💡 Попробуйте отправить тестовый вебхук снова:\n');
    console.log('   node setup/test_service_center_webhook.mjs\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

reregisterWebhook();


