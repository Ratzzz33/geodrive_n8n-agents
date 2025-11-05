import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const KEEP_ACTIVE = 'SLW5V3xUSKsyVYGE'; // Fixed version

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('🔍 Поиск всех Upsert Processor workflows с конфликтом paths...\n');

  // Получаем все workflows
  const allWorkflows = await request('GET', '/workflows');
  
  // Фильтруем Upsert Processor workflows
  const upsertWorkflows = allWorkflows.data.filter(wf => 
    wf.name && wf.name.includes('Upsert Processor')
  );

  console.log(`Найдено ${upsertWorkflows.length} Upsert Processor workflows:\n`);

  const toDeactivate = [];

  for (const wf of upsertWorkflows) {
    const isActive = wf.active ? '✅' : '❌';
    const isFixed = wf.id === KEEP_ACTIVE ? '⭐ FIXED' : '';
    
    console.log(`${isActive} ${wf.name}`);
    console.log(`   ID: ${wf.id} ${isFixed}`);
    console.log(`   Active: ${wf.active}`);
    
    // Добавляем в список на деактивацию если активен и не Fixed
    if (wf.active && wf.id !== KEEP_ACTIVE) {
      toDeactivate.push(wf);
    }
    console.log('');
  }

  if (toDeactivate.length === 0) {
    console.log('✅ Конфликтов нет! Только Fixed workflow активен.');
    return;
  }

  console.log('═'.repeat(70));
  console.log(`\n⚠️  Найдено ${toDeactivate.length} активных workflows с конфликтом:\n`);

  for (const wf of toDeactivate) {
    console.log(`   • ${wf.name} (${wf.id})`);
  }

  console.log('\n🔧 Деактивирую их...\n');

  for (const wf of toDeactivate) {
    try {
      await request('PATCH', `/workflows/${wf.id}`, { active: false });
      console.log(`   ✅ Деактивирован: ${wf.name} (${wf.id})`);
    } catch (error) {
      console.log(`   ❌ Ошибка при деактивации ${wf.id}: ${error.message}`);
    }
  }

  console.log('\n═'.repeat(70));
  console.log('\n✅ ГОТОВО! Теперь только Fixed workflow обрабатывает /webhook/upsert-processor');
  console.log(`\n📌 Активный workflow: SLW5V3xUSKsyVYGE`);
  console.log(`   URL: https://n8n.rentflow.rentals/webhook/upsert-processor`);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

