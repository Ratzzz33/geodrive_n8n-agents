import https from 'https';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const WORKFLOW_ID = 'ihRLR0QCJySx319b';

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function checkLatestExecution() {
  console.log('🔍 Проверка последнего execution...\n');
  
  // 1. Получаем список последних executions
  console.log('1️⃣ Получаю список последних executions...');
  const executions = await apiRequest('GET', `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=5`);
  const execList = executions.data || executions;
  
  if (!execList || !execList.data || execList.data.length === 0) {
    throw new Error('Не найдено executions');
  }
  
  const latestExecution = execList.data[0];
  const executionId = latestExecution.id;
  
  console.log(`✅ Последний execution: #${executionId}`);
  console.log(`   Статус: ${latestExecution.status}`);
  console.log(`   Начало: ${latestExecution.startedAt}`);
  console.log(`   Конец: ${latestExecution.stoppedAt || 'не завершен'}\n`);
  
  // 2. Получаем детальные данные execution
  console.log('2️⃣ Получаю детальные данные execution...');
  const execution = await apiRequest('GET', `/api/v1/executions/${executionId}?includeData=true`);
  const execData = execution.data || execution;
  
  if (!execData) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Execution получен\n`);
  
  // 3. Анализируем статус
  console.log('3️⃣ Анализ статуса execution...\n');
  console.log(`   Статус: ${execData.status}`);
  console.log(`   Завершен: ${execData.finished ? 'да' : 'нет'}`);
  console.log(`   Выполнено нод: ${execData.summary?.executedNodes || 0} из ${execData.summary?.totalNodes || 0}`);
  console.log(`   Всего элементов: ${execData.summary?.totalItems || 0}\n`);
  
  if (execData.status === 'error') {
    console.log('❌ ОШИБКА В EXECUTION!\n');
    
    // Проверяем общую ошибку
    if (execData.error) {
      console.log('4️⃣ Общая ошибка execution:\n');
      console.log(`   Сообщение: ${execData.error.message || 'нет'}`);
      console.log(`   Нода: ${execData.error.node?.name || 'нет'}`);
      console.log(`   Описание: ${execData.error.description || 'нет'}\n`);
    }
  }
  
  // 4. Анализируем ноды
  console.log('5️⃣ Анализ нод...\n');
  
  const nodes = execData.nodes || {};
  const nodeNames = Object.keys(nodes);
  
  // Ищем ноды с ошибками
  const errorNodes = [];
  const successNodes = [];
  
  for (const nodeName of nodeNames) {
    const node = nodes[nodeName];
    if (node.status === 'error') {
      errorNodes.push({ name: nodeName, node });
    } else if (node.status === 'success') {
      successNodes.push({ name: nodeName, node });
    }
  }
  
  if (errorNodes.length > 0) {
    console.log(`❌ Ноды с ошибками (${errorNodes.length}):\n`);
    for (const { name, node } of errorNodes) {
      console.log(`   ${name}:`);
      console.log(`      Статус: ${node.status}`);
      console.log(`      Execution time: ${node.executionTime}ms`);
      console.log(`      Items input: ${node.itemsInput}`);
      console.log(`      Items output: ${node.itemsOutput}`);
      
      if (node.error) {
        console.log(`      Ошибка: ${node.error.message || JSON.stringify(node.error)}`);
      }
      
      // Проверяем детали ошибки
      if (node.data && node.data.error) {
        console.log(`      Детали ошибки: ${JSON.stringify(node.data.error, null, 2)}`);
      }
      
      console.log('');
    }
  } else {
    console.log('✅ Нод с ошибками не найдено\n');
  }
  
  // 5. Проверяем ключевые ноды
  console.log('6️⃣ Проверка ключевых нод...\n');
  
  const keyNodes = ['Normalize Cars', 'Split Cars and Prices', 'Find Car ID', 'Merge Car ID', 'Format Price Values', 'Save Prices', 'Save Cars'];
  
  for (const nodeName of keyNodes) {
    const node = nodes[nodeName];
    if (node) {
      console.log(`   ${nodeName}:`);
      console.log(`      Статус: ${node.status}`);
      console.log(`      Items output: ${node.itemsOutput}`);
      
      if (node.status === 'error') {
        console.log(`      ❌ ОШИБКА!`);
        if (node.error) {
          console.log(`      Сообщение: ${node.error.message || JSON.stringify(node.error)}`);
        }
      } else if (node.status === 'success') {
        console.log(`      ✅ Успешно`);
      }
      console.log('');
    } else {
      console.log(`   ${nodeName}: ⚠️  не найдена\n`);
    }
  }
  
  // 6. Если есть ошибка в Save Prices или Save Cars, получаем детали
  const savePrices = nodes['Save Prices'];
  const saveCars = nodes['Save Cars'];
  
  if (savePrices && savePrices.status === 'error') {
    console.log('7️⃣ Детали ошибки в "Save Prices":\n');
    if (savePrices.error) {
      console.log(`   ${JSON.stringify(savePrices.error, null, 2)}\n`);
    }
  }
  
  if (saveCars && saveCars.status === 'error') {
    console.log('8️⃣ Детали ошибки в "Save Cars":\n');
    if (saveCars.error) {
      console.log(`   ${JSON.stringify(saveCars.error, null, 2)}\n`);
    }
  }
  
  // 7. Итоговый вывод
  console.log('9️⃣ ИТОГОВЫЙ ВЫВОД...\n');
  
  if (errorNodes.length > 0) {
    console.log(`❌ Найдено ${errorNodes.length} нод с ошибками:`);
    errorNodes.forEach(({ name }) => {
      console.log(`   - ${name}`);
    });
    console.log('\n⚠️  Нужно исправить ошибки в этих нодах');
  } else if (execData.status === 'error') {
    console.log('❌ Execution завершился с ошибкой, но конкретные ноды с ошибками не найдены');
    console.log('   Проверьте общую ошибку execution');
  } else {
    console.log('✅ Execution завершился успешно');
  }
  
  console.log('\n✅ Проверка завершена!\n');
}

checkLatestExecution()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

