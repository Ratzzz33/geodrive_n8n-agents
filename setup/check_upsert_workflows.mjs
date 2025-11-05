import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

function listWorkflows() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}/workflows`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
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
          resolve(result.data || []);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Поиск всех Upsert Processor workflows...\n');

  try {
    const workflows = await listWorkflows();
    
    // Фильтруем только Upsert Processor
    const upsertWorkflows = workflows.filter(w => 
      w.name.toLowerCase().includes('upsert')
    );

    if (upsertWorkflows.length === 0) {
      console.log('❌ Не найдено Upsert Processor workflows');
      return;
    }

    console.log(`📋 Найдено ${upsertWorkflows.length} Upsert Processor workflow(s):\n`);
    console.log('═'.repeat(80) + '\n');

    upsertWorkflows.forEach((wf, index) => {
      console.log(`${index + 1}. ${wf.name}`);
      console.log(`   ID: ${wf.id}`);
      console.log(`   Активен: ${wf.active ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`   Создан: ${new Date(wf.createdAt).toLocaleString('ru-RU')}`);
      console.log(`   Обновлен: ${new Date(wf.updatedAt).toLocaleString('ru-RU')}`);
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${wf.id}`);
      
      // Определяем версию по имени
      if (wf.name.includes('Parallel')) {
        console.log(`   📝 Тип: Параллельная версия (все филиалы одновременно)`);
      } else if (wf.name.includes('Cached')) {
        console.log(`   📝 Тип: Версия с кэшированием`);
      } else if (wf.name.includes('Sequential') || wf.name.includes('(Seq')) {
        console.log(`   📝 Тип: Последовательная версия (recommended)`);
      } else {
        console.log(`   📝 Тип: Старая версия (базовая)`);
      }
      
      console.log('─'.repeat(80) + '\n');
    });

    console.log('\n💡 РЕКОМЕНДАЦИИ:\n');
    
    const sequential = upsertWorkflows.find(w => 
      w.name.includes('Sequential') || (!w.name.includes('Parallel') && !w.name.includes('Cached') && w.active)
    );
    
    if (sequential) {
      console.log(`✅ ИСПОЛЬЗУЙТЕ: "${sequential.name}" (ID: ${sequential.id})`);
      console.log(`   Webhook: /webhook/upsert-processor`);
      console.log(`   Статус: ${sequential.active ? '✅ Активен' : '❌ Неактивен - нужно активировать!'}`);
      console.log(`   Это версия работает идеально!\n`);
    }
    
    console.log('📌 Остальные версии:');
    console.log('   • Parallel - быстрее, но возвращает пустой ответ (нужна доработка)');
    console.log('   • Cached - самая быстрая, но возвращает пустой ответ (нужна доработка)');
    console.log('   • Старые версии - можно удалить после миграции\n');
    
    console.log('🔧 Для Webhooks Monitor используйте:');
    console.log('   POST http://46.224.17.15:3000/upsert-processor');
    console.log('   (внутренний endpoint Jarvis API, который вызовет Sequential версию)\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

main();

