import https from 'https';

const WEBHOOK_URL = 'https://n8n.rentflow.rentals/webhook/upsert-processor';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const testData = {
  rentprog_id: '501190',
  entity_type: 'booking'
};

console.log('🧪 Тест: отправка webhook + проверка execution\n');
console.log('═'.repeat(70));

// Отправляем webhook
function sendWebhook() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(testData);
    const url = new URL(WEBHOOK_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      rejectUnauthorized: false
    };

    console.log('1️⃣  Отправка webhook...');
    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`   ✅ Ответ получен: ${res.statusCode} (${duration}ms)\n`);
        resolve({ status: res.statusCode, body: responseData, duration });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Получаем executions
function getExecutions() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}/executions?limit=5&includeData=true`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Отправляем webhook
  const webhookResult = await sendWebhook();
  
  console.log('📄 Ответ webhook:');
  try {
    const response = JSON.parse(webhookResult.body);
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.log(webhookResult.body);
  }
  console.log('');

  // Ждем немного чтобы execution записался
  console.log('⏳ Ожидание 2 секунды...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Получаем последние executions
  console.log('2️⃣  Получение последних executions...');
  const executions = await getExecutions();
  
  if (!executions.data || executions.data.length === 0) {
    console.log('   ❌ Нет executions!\n');
    console.log('⚠️  ПРОБЛЕМА: Webhook не вызывает workflow!');
    console.log('   Возможные причины:');
    console.log('   1. Webhook path не зарегистрирован');
    console.log('   2. Конфликт webhook paths между workflows');
    console.log('   3. Workflow деактивирован');
    return;
  }

  console.log(`   ✅ Найдено executions: ${executions.data.length}\n`);
  console.log('═'.repeat(70) + '\n');

  // Показываем последние 3 execution
  executions.data.slice(0, 3).forEach((exec, index) => {
    console.log(`${index + 1}. Execution ID: ${exec.id}`);
    console.log(`   Workflow: ${exec.workflowName || 'Unknown'}`);
    console.log(`   Status: ${exec.status}`);
    console.log(`   Started: ${new Date(exec.startedAt).toLocaleString('ru-RU')}`);
    console.log(`   Duration: ${exec.duration || 'N/A'}ms`);
    console.log('');
  });

  // Анализируем самый последний
  const latest = executions.data[0];
  console.log('═'.repeat(70));
  console.log('\n🔍 АНАЛИЗ ПОСЛЕДНЕГО EXECUTION:\n');
  console.log(`Workflow: ${latest.workflowName}`);
  console.log(`ID: ${latest.workflowId}`);
  
  if (latest.workflowId === 'SLW5V3xUSKsyVYGE') {
    console.log('✅ Это наш Fixed workflow!');
  } else {
    console.log('⚠️  Это НЕ Fixed workflow! Возможно конфликт paths');
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

