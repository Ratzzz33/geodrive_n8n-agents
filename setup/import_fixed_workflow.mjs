import https from 'https';
import fs from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const FIXED_WF_ID = 'SLW5V3xUSKsyVYGE';

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
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${result.message || responseData}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}\nResponse: ${responseData}`));
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
  console.log('🔄 Обновление Fixed workflow в n8n...\n');

  // Читаем JSON
  console.log('1️⃣  Читаю JSON файл...');
  const wfContent = fs.readFileSync('n8n-workflows/rentprog-upsert-processor-fixed.json', 'utf8');
  const wfJson = JSON.parse(wfContent);
  console.log(`   ✅ Загружен: ${wfJson.name}\n`);

  // Проверяем существующий workflow
  console.log('2️⃣  Проверяю существующий workflow...');
  try {
    const existing = await request('GET', `/workflows/${FIXED_WF_ID}`);
    
    if (!existing || !existing.data) {
      throw new Error('404');
    }
    
    console.log(`   ✅ Найден: ${existing.data.name} (${existing.data.id})`);
    console.log(`   Активен: ${existing.data.active}\n`);

    // Обновляем
    console.log('3️⃣  Обновляю workflow...');
    const updated = await request('PUT', `/workflows/${FIXED_WF_ID}`, {
      id: FIXED_WF_ID,
      name: wfJson.name,
      nodes: wfJson.nodes,
      connections: wfJson.connections,
      settings: wfJson.settings || { executionOrder: 'v1' },
      active: true
    });

    console.log(`   ✅ Обновлен успешно!\n`);
    console.log('═'.repeat(70));
    console.log('\n✅ Fixed workflow обновлен и активирован!');
    console.log(`\n📌 Workflow: ${updated.data.name}`);
    console.log(`   ID: ${updated.data.id}`);
    console.log(`   Активен: ${updated.data.active}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${updated.data.id}`);
    console.log(`   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor`);

  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`   ⚠️  Workflow ${FIXED_WF_ID} не найден в n8n!`);
      console.log('   Создаем новый...\n');

      // Создаем новый (без active - это read-only при создании)
      const created = await request('POST', '/workflows', {
        name: wfJson.name,
        nodes: wfJson.nodes,
        connections: wfJson.connections,
        settings: wfJson.settings || { executionOrder: 'v1' }
      });

      console.log('DEBUG: created =', JSON.stringify(created, null, 2));

      const newId = created.id;
      console.log(`   ✅ Создан: ${newId}\n`);

      // Активируем
      await request('PATCH', `/workflows/${newId}`, { active: true });
      console.log(`   ✅ Активирован!\n`);

      console.log('═'.repeat(70));
      console.log('\n✅ Fixed workflow создан и активирован!');
      console.log(`\n📌 Workflow: ${created.name}`);
      console.log(`   ID: ${newId}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${newId}`);
      console.log(`   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor`);
      console.log(`\n⚠️  ВАЖНО: Запомните новый ID: ${newId}`);
    } else {
      throw error;
    }
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

