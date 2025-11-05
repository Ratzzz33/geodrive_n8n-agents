import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const KEEP_ACTIVE = 'fijJpRlLjgpxSJE7'; // Новый Fixed с токенами

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
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function main() {
  console.log('🔧 Исправление активации workflows...\n');

  // Получаем все workflows
  const allWorkflows = await request('GET', '/workflows');
  
  // Фильтруем Upsert Processor workflows
  const upsertWorkflows = allWorkflows.data.filter(wf => 
    wf.name && wf.name.includes('Upsert Processor')
  );

  console.log(`Найдено ${upsertWorkflows.length} Upsert Processor workflows\n`);

  // Деактивируем ВСЕ активные (кроме нового)
  for (const wf of upsertWorkflows) {
    if (wf.active && wf.id !== KEEP_ACTIVE) {
      console.log(`🔴 Деактивирую: ${wf.name} (${wf.id})`);
      try {
        await request('PATCH', `/workflows/${wf.id}`, { active: false });
        console.log(`   ✅ Деактивирован\n`);
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}\n`);
      }
    }
  }

  // Активируем новый
  console.log(`🟢 Активирую: fijJpRlLjgpxSJE7`);
  try {
    await request('PATCH', `/workflows/${KEEP_ACTIVE}`, { active: true });
    console.log(`   ✅ Активирован\n`);
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}\n`);
  }

  console.log('═'.repeat(70));
  console.log('\n✅ Готово!');
  console.log(`\n📌 Активен только: fijJpRlLjgpxSJE7`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/fijJpRlLjgpxSJE7`);
  console.log(`   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor`);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

