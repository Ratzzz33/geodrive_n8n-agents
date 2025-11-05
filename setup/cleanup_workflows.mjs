import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const KEEP = 'fijJpRlLjgpxSJE7'; // ЕДИНСТВЕННЫЙ рабочий workflow

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method,
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
  console.log('🗑️  Удаление лишних Upsert Processor workflows...\n');

  // Получаем все workflows
  const allWorkflows = await request('GET', '/workflows');
  
  // Фильтруем Upsert Processor workflows
  const upsertWorkflows = allWorkflows.data.filter(wf => 
    wf.name && wf.name.includes('Upsert Processor')
  );

  console.log(`📋 Найдено ${upsertWorkflows.length} Upsert Processor workflows:\n`);

  const toDelete = [];

  for (const wf of upsertWorkflows) {
    if (wf.id === KEEP) {
      console.log(`✅ ОСТАВЛЯЕМ: ${wf.name}`);
      console.log(`   ID: ${wf.id}`);
      console.log(`   Активен: ${wf.active}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${wf.id}\n`);
    } else {
      console.log(`🗑️  УДАЛИМ: ${wf.name}`);
      console.log(`   ID: ${wf.id}\n`);
      toDelete.push(wf);
    }
  }

  if (toDelete.length === 0) {
    console.log('✅ Все уже в порядке! Нет лишних workflows.');
    return;
  }

  console.log('═'.repeat(70));
  console.log(`\n⚠️  Будет удалено: ${toDelete.length} workflows\n`);

  for (const wf of toDelete) {
    try {
      await request('DELETE', `/workflows/${wf.id}`);
      console.log(`   ✅ Удален: ${wf.name} (${wf.id})`);
    } catch (error) {
      console.log(`   ❌ Ошибка при удалении ${wf.id}: ${error.message}`);
    }
  }

  console.log('\n═'.repeat(70));
  console.log('\n✅ Очистка завершена!');
  console.log(`\n📌 Остался ЕДИНСТВЕННЫЙ workflow:`);
  console.log(`   ID: ${KEEP}`);
  console.log(`   Название: RentProg Upsert Processor (Fixed)`);
  console.log(`   URL: https://n8n.rentflow.rentals/workflow/${KEEP}`);
  console.log(`   Webhook: https://n8n.rentflow.rentals/webhook/upsert-processor`);
  console.log('\n💡 Теперь все изменения делаем ТОЛЬКО в этом workflow!');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
});

