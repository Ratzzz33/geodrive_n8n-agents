import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'tx0QQ0soDfPzQuUp'; // Старый Sequential

function getRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_HOST}${path}`);
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
  console.log('🔍 Получение последнего execution для Fixed Upsert Processor...\n');

  // Получаем список executions
  console.log('1️⃣  Получаем список executions...');
  const executions = await getRequest(`/executions?workflowId=${WORKFLOW_ID}&limit=1&includeData=true`);
  
  if (!executions.data || executions.data.length === 0) {
    console.log('❌ Нет executions для этого workflow');
    return;
  }

  const lastExecution = executions.data[0];
  console.log(`   ✅ Найден execution: ${lastExecution.id}`);
  console.log(`   Статус: ${lastExecution.status}`);
  console.log(`   Время: ${new Date(lastExecution.startedAt).toLocaleString('ru-RU')}\n`);

  console.log('═'.repeat(80) + '\n');

  // Анализируем данные
  const data = lastExecution.data;
  
  if (!data || !data.resultData || !data.resultData.runData) {
    console.log('⚠️  Нет данных выполнения');
    return;
  }

  const runData = data.resultData.runData;

  // Проверяем "Get RentProg Tokens"
  console.log('📋 Нода: "Get RentProg Tokens"');
  if (runData['Get RentProg Tokens']) {
    const nodeData = runData['Get RentProg Tokens'][0];
    if (nodeData.data && nodeData.data.main && nodeData.data.main[0]) {
      const output = nodeData.data.main[0][0].json;
      console.log('   ✅ Выполнена успешно');
      console.log(`   RentProg ID: ${output.rentprog_id}`);
      console.log(`   Entity Type: ${output.entity_type}`);
      
      if (output.tokens) {
        const tokenKeys = Object.keys(output.tokens);
        console.log(`   Токены получены: ${tokenKeys.length} филиалов`);
        tokenKeys.forEach(key => {
          const token = output.tokens[key];
          console.log(`      • ${key}: ${token ? token.substring(0, 20) + '...' : 'ПУСТО'}`);
        });
      } else {
        console.log('   ❌ Токены НЕ получены!');
      }
    }
  }
  console.log('');

  // Проверяем Try ноды
  const tryNodes = ['Try Tbilisi', 'Try Batumi', 'Try Kutaisi', 'Try Service Center'];
  
  for (const nodeName of tryNodes) {
    if (runData[nodeName]) {
      const nodeData = runData[nodeName][0];
      console.log(`📋 Нода: "${nodeName}"`);
      
      if (nodeData.error) {
        console.log(`   ❌ Ошибка: ${nodeData.error.message}`);
      } else if (nodeData.data && nodeData.data.main && nodeData.data.main[0]) {
        const output = nodeData.data.main[0][0];
        
        if (output.json && output.json.id) {
          console.log('   ✅ НАЙДЕНО!');
          console.log(`   ID: ${output.json.id}`);
          console.log(`   Данные: ${JSON.stringify(output.json).substring(0, 100)}...`);
        } else {
          console.log('   ❌ Не найдено (пустой ответ или 404)');
          
          // Показываем сырой ответ если есть
          if (output.json) {
            const keys = Object.keys(output.json);
            if (keys.length > 0) {
              console.log(`   Ответ: ${JSON.stringify(output.json).substring(0, 200)}`);
            }
          }
        }
      } else {
        console.log('   ⚠️  Нода не выполнялась или нет данных');
      }
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('\n💡 АНАЛИЗ:\n');

  // Делаем вывод
  const hasTokens = runData['Get RentProg Tokens'] && 
                    runData['Get RentProg Tokens'][0].data?.main?.[0]?.[0]?.json?.tokens;
  
  if (!hasTokens) {
    console.log('❌ ПРОБЛЕМА: Токены не получены!');
    console.log('   Решение: Проверить company tokens в коде');
  } else {
    const foundInAny = tryNodes.some(nodeName => {
      const nodeData = runData[nodeName]?.[0];
      return nodeData?.data?.main?.[0]?.[0]?.json?.id;
    });

    if (!foundInAny) {
      console.log('❌ ПРОБЛЕМА: Бронь не найдена ни в одном филиале!');
      console.log('   Возможные причины:');
      console.log('   1. Неправильный endpoint URL');
      console.log('   2. Нужен query parameter ?branch=xxx');
      console.log('   3. Бронь действительно не существует');
      console.log('   4. Токены валидны, но не дают доступ к этой брони');
    }
  }
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
});

