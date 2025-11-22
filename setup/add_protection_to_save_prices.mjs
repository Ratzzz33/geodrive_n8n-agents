import https from 'https';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';

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

async function addProtectionToSavePrices() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // 1. Обновляем ноду "Format Price Values" - добавляем проверку на пустые значения
  console.log('🔧 Обновляю ноду "Format Price Values" (добавляю защиту от пустых значений)...');
  const formatPriceValuesNode = workflow.nodes.find(n => n.id === 'enrich-car-id-1763298306809');
  if (!formatPriceValuesNode) {
    throw new Error('Нода "Format Price Values" не найдена');
  }
  
  const currentCode = formatPriceValuesNode.parameters.jsCode;
  
  // Добавляем проверку на пустые значения перед формированием price_values
  const updatedCode = currentCode.replace(
    `// Формируем структуру price_values для сохранения\nconst priceData = $input.item.json;\n\nif (!priceData.car_id) {\n  // Если car_id не найден, пропускаем эту запись\n  return [];\n}\n\nconst periods = ['1-3 дня', '4-7 дней', '8-15 дней', '16-30 дней', '31+ дней'];\nconst values = priceData.values || [];`,
    `// Формируем структуру price_values для сохранения\nconst priceData = $input.item.json;\n\n// КРИТИЧЕСКАЯ ПРОВЕРКА: Пропускаем запись, если есть пустые значения\nif (!priceData.car_id) {\n  // Если car_id не найден, пропускаем эту запись\n  return [];\n}\n\nif (!priceData.price_id || priceData.price_id === '' || priceData.price_id === null) {\n  // Если price_id пустой, пропускаем эту запись\n  return [];\n}\n\nif (!priceData.season_id || priceData.season_id === null || priceData.season_id === '') {\n  // Если season_id пустой, пропускаем эту запись\n  return [];\n}\n\nconst values = priceData.values || [];\nif (!Array.isArray(values) || values.length === 0) {\n  // Если values пустой массив, пропускаем эту запись\n  return [];\n}\n\n// Проверяем, что все значения в массиве не пустые\nif (values.every(v => v === null || v === undefined || v === '' || v === 0)) {\n  // Если все значения пустые или нулевые, пропускаем эту запись\n  return [];\n}\n\nconst periods = ['1-3 дня', '4-7 дней', '8-15 дней', '16-30 дней', '31+ дней'];`
  );
  
  formatPriceValuesNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Format Price Values" обновлена с защитой от пустых значений\n');
  
  // 2. Обновляем ноду "Merge Car ID" - добавляем проверку на пустые значения
  console.log('🔧 Обновляю ноду "Merge Car ID" (добавляю защиту от пустых значений)...');
  const mergeCarIdNode = workflow.nodes.find(n => n.id === 'merge-car-id-1763298306809');
  if (!mergeCarIdNode) {
    throw new Error('Нода "Merge Car ID" не найдена');
  }
  
  const mergeCarIdCode = mergeCarIdNode.parameters.jsCode;
  
  const updatedMergeCarIdCode = mergeCarIdCode.replace(
    `if (!carIdResult || !carIdResult.car_id) {\n  // Если car_id не найден, пропускаем эту запись\n  return [];\n}\n\nreturn [{\n  json: {\n    ...priceData,\n    car_id: carIdResult.car_id\n  }\n}];`,
    `if (!carIdResult || !carIdResult.car_id) {\n  // Если car_id не найден, пропускаем эту запись\n  return [];\n}\n\n// КРИТИЧЕСКАЯ ПРОВЕРКА: Пропускаем запись, если есть пустые значения\nif (!priceData.price_id || priceData.price_id === '' || priceData.price_id === null) {\n  // Если price_id пустой, пропускаем эту запись\n  return [];\n}\n\nif (!priceData.season_id || priceData.season_id === null || priceData.season_id === '') {\n  // Если season_id пустой, пропускаем эту запись\n  return [];\n}\n\nconst values = priceData.values || [];\nif (!Array.isArray(values) || values.length === 0) {\n  // Если values пустой массив, пропускаем эту запись\n  return [];\n}\n\nreturn [{\n  json: {\n    ...priceData,\n    car_id: carIdResult.car_id\n  }\n}];`
  );
  
  mergeCarIdNode.parameters.jsCode = updatedMergeCarIdCode;
  console.log('✅ Нода "Merge Car ID" обновлена с защитой от пустых значений\n');
  
  // Очищаем системные поля перед обновлением
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  console.log('📤 Обновляю workflow в n8n...\n');
  
  const updateResult = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, cleanWorkflow);
  
  console.log('✅ Workflow успешно обновлен!\n');
  console.log('📋 Изменения:');
  console.log('  ✅ Добавлена проверка на пустой price_id');
  console.log('  ✅ Добавлена проверка на пустой season_id');
  console.log('  ✅ Добавлена проверка на пустой массив values');
  console.log('  ✅ Добавлена проверка на все нулевые значения в values');
  console.log('\n⚠️  ВАЖНО: Теперь пустые значения не будут попадать в таблицу car_prices!');
}

addProtectionToSavePrices()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

