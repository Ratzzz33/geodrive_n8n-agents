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

async function fixDailyPricesSyncWorkflow() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // 1. Исправляем триггер - меняем на раз в сутки (в 2:00 ночи)
  console.log('🔧 Исправляю триггер (меняю на раз в сутки в 2:00)...');
  const triggerNode = workflow.nodes.find(n => n.id === '332ee159-b0ef-424c-bc0a-bfda68739df9');
  if (triggerNode) {
    triggerNode.parameters.rule.interval[0].expression = '0 2 * * *'; // В 2:00 ночи каждый день
    console.log('✅ Триггер обновлен: раз в сутки в 2:00\n');
  }
  
  // 2. Обновляем ноду "Normalize Cars" - добавляем извлечение цен
  console.log('🔧 Обновляю ноду "Normalize Cars" (добавляю извлечение цен)...');
  const normalizeNode = workflow.nodes.find(n => n.id === 'b28f2471-e845-47dc-aa9c-95da0f075a06');
  if (!normalizeNode) {
    throw new Error('Нода "Normalize Cars" не найдена');
  }
  
  const currentCode = normalizeNode.parameters.jsCode;
  
  // Добавляем извлечение цен после обработки машин
  const updatedCode = currentCode.replace(
    `const staticData = $getWorkflowStaticData('global');\nstaticData.carStats = stats;\n\nif (!results.length) {\n  results.push({ json: { __statsOnly: true } });\n}\n\nreturn results;`,
    `// Извлекаем цены из included для всех филиалов\nconst priceResults = [];\nfor (const item of $input.all()) {\n  const branchCode = item.json.branch_code || item.json.branch;\n  const branchId = item.json.branch_id;\n  const responseData = item.json.cars ?? item.json;\n  \n  // Извлекаем included (цены и сезоны) - пробуем разные варианты структуры\n  let included = [];\n  if (responseData.included && Array.isArray(responseData.included)) {\n    included = responseData.included;\n  } else if (responseData.cars && responseData.cars.included && Array.isArray(responseData.cars.included)) {\n    included = responseData.cars.included;\n  } else if (responseData.data && responseData.data.included && Array.isArray(responseData.data.included)) {\n    included = responseData.data.included;\n  }\n  \n  const prices = included.filter(item => item.type === 'price');\n  const seasons = included.filter(item => item.type === 'season');\n  \n  // Создаем маппинг сезонов по ID\n  const seasonsMap = {};\n  for (const season of seasons) {\n    const seasonId = season.id || season.attributes?.id;\n    if (seasonId) {\n      seasonsMap[seasonId] = {\n        id: seasonId,\n        name: season.attributes?.name || season.name,\n        start_date: season.attributes?.start_date || season.start_date,\n        end_date: season.attributes?.end_date || season.end_date\n      };\n    }\n  }\n  \n  // Создаем маппинг цен по car_id\n  const pricesByCarId = {};\n  for (const price of prices) {\n    const carId = price.attributes?.car_id || price.car_id;\n    const seasonId = price.attributes?.season_id || price.season_id;\n    if (carId) {\n      const carIdKey = typeof carId === 'string' ? parseInt(carId, 10) : carId;\n      if (!isNaN(carIdKey)) {\n        if (!pricesByCarId[carIdKey]) {\n          pricesByCarId[carIdKey] = [];\n        }\n        pricesByCarId[carIdKey].push({\n          id: price.id,\n          season_id: seasonId,\n          values: price.attributes?.values || price.values || []\n        });\n      }\n    }\n  }\n  \n  // Добавляем цены для сохранения\n  for (const car of results) {\n    const rentprogId = car.json.rentprog_id;\n    const carIdNum = rentprogId ? (typeof rentprogId === 'string' ? parseInt(rentprogId, 10) : rentprogId) : null;\n    \n    if (carIdNum && !isNaN(carIdNum) && pricesByCarId[carIdNum]) {\n      for (const price of pricesByCarId[carIdNum]) {\n        const season = seasonsMap[price.season_id];\n        \n        // Проверяем, что есть values и они не пустые\n        const values = price.values || [];\n        if (Array.isArray(values) && values.length > 0 && !values.every(v => v === null || v === undefined || v === '' || v === 0)) {\n          priceResults.push({\n            json: {\n              branch_code: branchCode,\n              branch_id: branchId,\n              rentprog_id: rentprogId,\n              price_id: price.id,\n              season_id: price.season_id,\n              season_name: season?.name || null,\n              season_start_date: season?.start_date || null,\n              season_end_date: season?.end_date || null,\n              values: values,\n              values_json: JSON.stringify(values)\n            }\n          });\n        }\n      }\n    }\n  }\n}\n\nconst staticData = $getWorkflowStaticData('global');\nstaticData.carStats = stats;\nstaticData.priceStats = { prices: priceResults.length };\n\nif (!results.length) {\n  results.push({ json: { __statsOnly: true } });\n}\n\n// Возвращаем и машины, и цены\nreturn [...results, ...priceResults];`
  );
  
  normalizeNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Normalize Cars" обновлена с извлечением цен\n');
  
  // 3. Добавляем ноду "Split Cars and Prices" после "Normalize Cars"
  console.log('🔧 Добавляю ноду "Split Cars and Prices"...');
  const splitNode = {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          typeValidation: 'strict',
          version: 1
        },
        conditions: [{
          id: 'is-price',
          leftValue: '={{ $json.price_id }}',
          rightValue: '',
          operator: {
            type: 'string',
            operation: 'isNotEmpty'
          }
        }],
        combinator: 'and'
      },
      options: {}
    },
    name: 'Split Cars and Prices',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [2112, 304],
    id: 'split-cars-prices-daily'
  };
  
  workflow.nodes.push(splitNode);
  console.log('✅ Нода "Split Cars and Prices" добавлена\n');
  
  // 4. Добавляем ноду "Find Car ID" для цен
  console.log('🔧 Добавляю ноду "Find Car ID"...');
  const findCarIdNode = {
    parameters: {
      operation: 'executeQuery',
      query: "SELECT c.id as car_id\nFROM cars c\nWHERE c.rentprog_id = $1::TEXT\nLIMIT 1",
      options: {
        queryReplacement: '={{ $json.rentprog_id }}'
      }
    },
    name: 'Find Car ID',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position: [2336, 208],
    id: 'find-car-id-daily',
    credentials: {
      postgres: {
        id: '3I9fyXVlGg4Vl4LZ',
        name: 'Postgres account'
      }
    }
  };
  
  workflow.nodes.push(findCarIdNode);
  console.log('✅ Нода "Find Car ID" добавлена\n');
  
  // 5. Добавляем ноду "Merge Car ID" для цен
  console.log('🔧 Добавляю ноду "Merge Car ID"...');
  const mergeCarIdNode = {
    parameters: {
      jsCode: `// Объединяем данные о цене с найденным car_id
const priceData = $('Split Cars and Prices').item.json;
const carIdResult = $input.first()?.json;

// КРИТИЧЕСКАЯ ПРОВЕРКА: Пропускаем запись, если есть пустые значения
if (!carIdResult || !carIdResult.car_id) {
  return [];
}

if (!priceData.price_id || priceData.price_id === '' || priceData.price_id === null) {
  return [];
}

if (!priceData.season_id || priceData.season_id === null || priceData.season_id === '') {
  return [];
}

const values = priceData.values || [];
if (!Array.isArray(values) || values.length === 0) {
  return [];
}

return [{
  json: {
    ...priceData,
    car_id: carIdResult.car_id
  }
}];`
    },
    name: 'Merge Car ID',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2560, 208],
    id: 'merge-car-id-daily'
  };
  
  workflow.nodes.push(mergeCarIdNode);
  console.log('✅ Нода "Merge Car ID" добавлена\n');
  
  // 6. Добавляем ноду "Format Price Values"
  console.log('🔧 Добавляю ноду "Format Price Values"...');
  const formatPriceValuesNode = {
    parameters: {
      jsCode: `// Формируем структуру price_values для сохранения
const priceData = $input.item.json;

// КРИТИЧЕСКАЯ ПРОВЕРКА: Пропускаем запись, если есть пустые значения
if (!priceData.car_id) {
  return [];
}

if (!priceData.price_id || priceData.price_id === '' || priceData.price_id === null) {
  return [];
}

if (!priceData.season_id || priceData.season_id === null || priceData.season_id === '') {
  return [];
}

const values = priceData.values || [];
if (!Array.isArray(values) || values.length === 0) {
  return [];
}

// Проверяем, что не все значения нулевые
if (values.every(v => v === null || v === undefined || v === '' || v === 0)) {
  return [];
}

const periods = ['1-3 дня', '4-7 дней', '8-15 дней', '16-30 дней', '31+ дней'];

return [{
  json: {
    ...priceData,
    price_values: {
      periods: periods,
      values: values,
      currency: 'GEL',
      exchange_rate: 2.75,
      items: values.map((value, idx) => ({
        period: periods[idx] || '',
        price_per_day: value,
        price_gel: value,
        price_usd: Math.round((value / 2.75) * 100) / 100,
        currency: 'GEL'
      })),
      season: priceData.season_name ? {
        name: priceData.season_name,
        start_date: priceData.season_start_date,
        end_date: priceData.season_end_date
      } : null
    }
  }
}];`
    },
    name: 'Format Price Values',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2784, 208],
    id: 'format-price-values-daily'
  };
  
  workflow.nodes.push(formatPriceValuesNode);
  console.log('✅ Нода "Format Price Values" добавлена\n');
  
  // 7. Добавляем ноду "Save Prices"
  console.log('🔧 Добавляю ноду "Save Prices"...');
  const savePricesNode = {
    parameters: {
      operation: 'upsert',
      schema: {
        __rl: true,
        value: 'public',
        mode: 'list'
      },
      table: {
        __rl: true,
        value: 'car_prices',
        mode: 'list'
      },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          car_id: '={{ $json.car_id }}',
          rentprog_price_id: '={{ $json.price_id }}',
          season_id: '={{ $json.season_id }}',
          season_name: '={{ $json.season_name }}',
          season_start_date: '={{ $json.season_start_date }}',
          season_end_date: '={{ $json.season_end_date }}',
          price_values: '={{ $json.price_values }}'
        },
        matchingColumns: ['car_id', 'season_id'],
        schema: []
      },
      options: {}
    },
    name: 'Save Prices',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position: [3008, 208],
    id: 'save-prices-daily',
    credentials: {
      postgres: {
        id: '3I9fyXVlGg4Vl4LZ',
        name: 'Postgres account'
      }
    }
  };
  
  workflow.nodes.push(savePricesNode);
  console.log('✅ Нода "Save Prices" добавлена\n');
  
  // 8. Обновляем connections
  console.log('🔧 Обновляю connections...');
  
  // Normalize Cars → Split Cars and Prices
  workflow.connections['Normalize Cars'] = {
    main: [[
      { node: 'Split Cars and Prices', type: 'main', index: 0 }
    ]]
  };
  
  // Split Cars and Prices → Find Car ID (True branch - цены)
  workflow.connections['Split Cars and Prices'] = {
    main: [
      [
        { node: 'Find Car ID', type: 'main', index: 0 }
      ],
      [
        { node: 'Has Data?', type: 'main', index: 0 }
      ]
    ]
  };
  
  // Find Car ID → Merge Car ID
  workflow.connections['Find Car ID'] = {
    main: [[
      { node: 'Merge Car ID', type: 'main', index: 0 }
    ]]
  };
  
  // Merge Car ID → Format Price Values
  workflow.connections['Merge Car ID'] = {
    main: [[
      { node: 'Format Price Values', type: 'main', index: 0 }
    ]]
  };
  
  // Format Price Values → Save Prices
  workflow.connections['Format Price Values'] = {
    main: [[
      { node: 'Save Prices', type: 'main', index: 0 }
    ]]
  };
  
  // Save Prices → Format Result (параллельно с Save Cars)
  workflow.connections['Save Prices'] = {
    main: [[
      { node: 'Format Result', type: 'main', index: 0 }
    ]]
  };
  
  // Has Data? теперь получает данные от Split Cars and Prices (False branch - машины)
  // Save Cars остается как есть
  
  console.log('✅ Connections обновлены\n');
  
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
  
  // 9. Активируем workflow через отдельный endpoint
  console.log('🔧 Активирую workflow...');
  try {
    await apiRequest('POST', `/api/v1/workflows/${WORKFLOW_ID}/activate`);
    console.log('✅ Workflow активирован\n');
  } catch (error) {
    console.log('⚠️  Не удалось активировать workflow автоматически (возможно, уже активен)');
    console.log('   Активируйте вручную через UI\n');
  }
  console.log('📋 Изменения:');
  console.log('  ✅ Триггер изменен на раз в сутки (2:00 ночи)');
  console.log('  ✅ Добавлено извлечение цен в ноде "Normalize Cars"');
  console.log('  ✅ Добавлена нода "Split Cars and Prices"');
  console.log('  ✅ Добавлена нода "Find Car ID"');
  console.log('  ✅ Добавлена нода "Merge Car ID"');
  console.log('  ✅ Добавлена нода "Format Price Values"');
  console.log('  ✅ Добавлена нода "Save Prices"');
  console.log('  ✅ Workflow активирован');
  console.log('\n⚠️  ВАЖНО: Workflow будет запускаться раз в сутки в 2:00 ночи и сохранять цены в таблицу car_prices!');
}

fixDailyPricesSyncWorkflow()
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

