import https from 'https';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const EXECUTION_ID = '27832';

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

async function checkExecution27832() {
  console.log('🔍 Детальная проверка execution #27832...\n');
  
  // Получаем execution с детальными данными
  console.log('1️⃣ Получаю execution данные...');
  const execution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true`);
  const execData = execution.data || execution;
  
  if (!execData) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Execution получен`);
  console.log(`   Статус: ${execData.status}`);
  console.log(`   Начало: ${execData.startedAt}`);
  console.log(`   Конец: ${execData.stoppedAt || 'не завершен'}`);
  console.log(`   Завершен: ${execData.finished ? 'да' : 'нет'}\n`);
  
  // Анализируем ошибки
  if (execData.status === 'error') {
    console.log('❌ ОШИБКА В EXECUTION!\n');
    
    // Общая ошибка
    if (execData.error) {
      console.log('2️⃣ Общая ошибка execution:\n');
      console.log(`   Сообщение: ${execData.error.message || 'нет'}`);
      console.log(`   Нода: ${execData.error.node?.name || 'нет'}`);
      console.log(`   Описание: ${execData.error.description || 'нет'}`);
      if (execData.error.stack) {
        console.log(`   Stack: ${execData.error.stack.substring(0, 500)}...`);
      }
      console.log('');
    }
  }
  
  // Анализируем ноды
  console.log('3️⃣ Анализ нод...\n');
  
  const nodes = execData.nodes || {};
  const nodeNames = Object.keys(nodes);
  
  console.log(`   Всего нод: ${nodeNames.length}`);
  
  // Ищем ноды с ошибками
  const errorNodes = [];
  for (const nodeName of nodeNames) {
    const node = nodes[nodeName];
    if (node.status === 'error') {
      errorNodes.push({ name: nodeName, node });
    }
  }
  
  if (errorNodes.length > 0) {
    console.log(`\n❌ Ноды с ошибками (${errorNodes.length}):\n`);
    for (const { name, node } of errorNodes) {
      console.log(`   ${name}:`);
      console.log(`      Статус: ${node.status}`);
      console.log(`      Execution time: ${node.executionTime}ms`);
      console.log(`      Items input: ${node.itemsInput}`);
      console.log(`      Items output: ${node.itemsOutput}`);
      
      if (node.error) {
        console.log(`      Ошибка: ${node.error.message || JSON.stringify(node.error)}`);
        if (node.error.stack) {
          console.log(`      Stack: ${node.error.stack.substring(0, 300)}...`);
        }
      }
      
      console.log('');
    }
  }
  
  // Проверяем ключевые ноды для сохранения
  console.log('4️⃣ Проверка нод сохранения...\n');
  
  const saveNodes = ['Save Prices', 'Save Cars', 'Find Car ID', 'Merge Car ID', 'Format Price Values'];
  
  for (const nodeName of saveNodes) {
    const node = nodes[nodeName];
    if (node) {
      console.log(`   ${nodeName}:`);
      console.log(`      Статус: ${node.status}`);
      console.log(`      Items input: ${node.itemsInput}`);
      console.log(`      Items output: ${node.itemsOutput}`);
      
      if (node.status === 'error') {
        console.log(`      ❌ ОШИБКА!`);
        if (node.error) {
          console.log(`      Сообщение: ${node.error.message || JSON.stringify(node.error)}`);
          if (node.error.description) {
            console.log(`      Описание: ${node.error.description}`);
          }
        }
        
        // Пытаемся получить детали из data
        if (node.data && node.data.error) {
          console.log(`      Детали: ${JSON.stringify(node.data.error, null, 2)}`);
        }
      } else if (node.status === 'success') {
        console.log(`      ✅ Успешно`);
      } else {
        console.log(`      ⚠️  Статус: ${node.status}`);
      }
      console.log('');
    }
  }
  
  // Если ошибка в Save Prices или Save Cars, получаем полные детали
  const savePrices = nodes['Save Prices'];
  const saveCars = nodes['Save Cars'];
  
  if (savePrices && savePrices.status === 'error') {
    console.log('5️⃣ ДЕТАЛЬНЫЙ АНАЛИЗ ОШИБКИ В "Save Prices":\n');
    
    // Получаем полные данные execution для этой ноды
    const fullExecution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true&mode=filtered&nodeNames[]=Save Prices&itemsLimit=3`);
    const fullData = fullExecution.data || fullExecution;
    
    if (fullData.nodes && fullData.nodes['Save Prices']) {
      const savePricesNode = fullData.nodes['Save Prices'];
      if (savePricesNode.error) {
        console.log(`   Полная ошибка:`);
        console.log(`   ${JSON.stringify(savePricesNode.error, null, 2)}\n`);
      }
      
      // Проверяем входные данные
      if (savePricesNode.data && savePricesNode.data.input) {
        const input = savePricesNode.data.input[0] || [];
        console.log(`   Входных элементов: ${input.length}`);
        if (input.length > 0) {
          console.log(`   Пример входных данных:`);
          console.log(`   ${JSON.stringify(input[0].json, null, 2).substring(0, 500)}...\n`);
        }
      }
    }
  }
  
  if (saveCars && saveCars.status === 'error') {
    console.log('6️⃣ ДЕТАЛЬНЫЙ АНАЛИЗ ОШИБКИ В "Save Cars":\n');
    
    // Получаем полные данные execution для этой ноды
    const fullExecution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true&mode=filtered&nodeNames[]=Save Cars&itemsLimit=3`);
    const fullData = fullExecution.data || fullExecution;
    
    if (fullData.nodes && fullData.nodes['Save Cars']) {
      const saveCarsNode = fullData.nodes['Save Cars'];
      if (saveCarsNode.error) {
        console.log(`   Полная ошибка:`);
        console.log(`   ${JSON.stringify(saveCarsNode.error, null, 2)}\n`);
      }
      
      // Проверяем входные данные
      if (saveCarsNode.data && saveCarsNode.data.input) {
        const input = saveCarsNode.data.input[0] || [];
        console.log(`   Входных элементов: ${input.length}`);
        if (input.length > 0) {
          console.log(`   Пример входных данных:`);
          console.log(`   ${JSON.stringify(input[0].json, null, 2).substring(0, 500)}...\n`);
        }
      }
    }
  }
  
  // Итоговый вывод
  console.log('7️⃣ ИТОГОВЫЙ ВЫВОД...\n');
  
  if (errorNodes.length > 0) {
    console.log(`❌ Найдено ${errorNodes.length} нод с ошибками:`);
    errorNodes.forEach(({ name, node }) => {
      console.log(`   - ${name}: ${node.error?.message || 'неизвестная ошибка'}`);
    });
  } else {
    console.log('⚠️  Ноды с ошибками не найдены в summary, но execution завершился с ошибкой');
    console.log('   Проверьте общую ошибку execution');
  }
  
  console.log('\n✅ Проверка завершена!\n');
}

checkExecution27832()
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

