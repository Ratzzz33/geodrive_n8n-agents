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

async function fixPricesCarIdMapping() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Исправляем ноду "Merge & Process" - исправляем маппинг car_id
  console.log('🔧 Исправляю ноду "Merge & Process" (исправляю маппинг car_id)...');
  const mergeProcessNode = workflow.nodes.find(n => n.id === '37a107c9-4431-44ac-88c6-3dd1e51951b3');
  if (!mergeProcessNode) {
    throw new Error('Нода "Merge & Process" не найдена');
  }
  
  const currentCode = mergeProcessNode.parameters.jsCode;
  
  // Исправляем маппинг - приводим car_id к числу для совместимости
  const updatedCode = currentCode.replace(
    `  // Создаем маппинг цен по car_id\n  const pricesByCarId = {};\n  for (const price of prices) {\n    const carId = price.attributes?.car_id;\n    const seasonId = price.attributes?.season_id;\n    if (carId) {\n      if (!pricesByCarId[carId]) {\n        pricesByCarId[carId] = [];\n      }\n      pricesByCarId[carId].push({\n        id: price.id,\n        season_id: seasonId,\n        values: price.attributes?.values || []\n      });\n    }\n  }`,
    `  // Создаем маппинг цен по car_id (приводим к числу для совместимости)\n  const pricesByCarId = {};\n  for (const price of prices) {\n    const carId = price.attributes?.car_id;\n    const seasonId = price.attributes?.season_id;\n    if (carId) {\n      // Приводим carId к числу для совместимости (может быть строка или число)\n      const carIdKey = typeof carId === 'string' ? parseInt(carId, 10) : carId;\n      if (!isNaN(carIdKey)) {\n        if (!pricesByCarId[carIdKey]) {\n          pricesByCarId[carIdKey] = [];\n        }\n        pricesByCarId[carIdKey].push({\n          id: price.id,\n          season_id: seasonId,\n          values: price.attributes?.values || []\n        });\n      }\n    }\n  }`
  ).replace(
    `    // Извлекаем attributes если это JSON:API формат\n    const attrs = car.attributes || car;\n    const carId = attrs.id || car.id;\n    \n    // Получаем цены для этой машины\n    const carPrices = pricesByCarId[carId] || [];`,
    `    // Извлекаем attributes если это JSON:API формат\n    const attrs = car.attributes || car;\n    const carId = attrs.id || car.id;\n    // Приводим carId к числу для совместимости с маппингом цен\n    const carIdNum = typeof carId === 'string' ? parseInt(carId, 10) : carId;\n    \n    // Получаем цены для этой машины (пробуем и числовой, и строковый ключ)\n    const carPrices = (carIdNum && !isNaN(carIdNum) ? pricesByCarId[carIdNum] : null) || pricesByCarId[carId] || [];`
  );
  
  mergeProcessNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Merge & Process" обновлена с исправленным маппингом car_id\n');
  
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
  console.log('  ✅ Добавлено приведение car_id к числу для совместимости');
  console.log('  ✅ Исправлен маппинг цен по car_id');
  console.log('  ✅ Добавлена проверка на NaN');
  console.log('\n⚠️  ВАЖНО: Протестируйте workflow, чтобы убедиться, что цены извлекаются!');
}

fixPricesCarIdMapping()
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

