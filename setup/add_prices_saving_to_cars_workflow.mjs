/**
 * Скрипт для добавления парсинга цен в workflow парсинга автомобилей
 * Обновляет workflow u3cOUuoaH5RSw7hm
 */

import { readFileSync, writeFileSync } from 'fs';

const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log('📥 Получаю текущий workflow...');
  
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status}`);
  }
  
  const result = await response.json();
  const workflow = result.data || result;
  const nodes = workflow.nodes || [];
  const connections = workflow.connections || {};
  
  console.log('✅ Workflow получен');
  
  // Находим ноду "Merge & Process"
  const mergeNode = nodes.find(n => n.name === 'Merge & Process');
  if (!mergeNode) {
    throw new Error('Node "Merge & Process" not found');
  }
  
  // Находим ноду "Save Snapshot"
  const saveSnapshotNode = nodes.find(n => n.name === 'Save Snapshot');
  if (!saveSnapshotNode) {
    throw new Error('Node "Save Snapshot" not found');
  }
  
  // Создаем ноду IF для разделения данных
  const splitNode = {
    name: 'Split Cars and Prices',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [mergeNode.position[0] + 200, mergeNode.position[1]],
    id: `split-${Date.now()}`,
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          typeValidation: 'strict'
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
      }
    }
  };
  
  // Создаем Postgres-ноду для поиска car_id
  const findCarIdNode = {
    name: 'Find Car ID',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position: [splitNode.position[0] + 200, splitNode.position[1] - 100],
    id: `find-car-id-${Date.now()}`,
    parameters: {
      operation: 'executeQuery',
      query: `SELECT c.id as car_id
FROM cars c
WHERE c.rentprog_id = '={{ $json.rentprog_id }}'
LIMIT 1`,
      options: {}
    },
    credentials: saveSnapshotNode.credentials
  };
  
  // Создаем Code-ноду для объединения данных
  const mergeCarIdNode = {
    name: 'Merge Car ID',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [findCarIdNode.position[0] + 200, findCarIdNode.position[1]],
    id: `merge-car-id-${Date.now()}`,
    parameters: {
      jsCode: `// Объединяем данные о цене с найденным car_id
const priceData = $('Split Cars and Prices').item.json;
const carIdResult = $input.first()?.json;

if (!carIdResult || !carIdResult.car_id) {
  // Если car_id не найден, пропускаем эту запись
  return [];
}

return [{
  json: {
    ...priceData,
    car_id: carIdResult.car_id
  }
}];`
    }
  };
  
  // Создаем Code-ноду для формирования price_values
  const enrichWithCarIdNode = {
    name: 'Format Price Values',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [findCarIdNode.position[0] + 200, findCarIdNode.position[1]],
    id: `enrich-car-id-${Date.now()}`,
    parameters: {
      jsCode: `// Формируем структуру price_values для сохранения
const priceData = $input.item.json;

if (!priceData.car_id) {
  // Если car_id не найден, пропускаем эту запись
  return [];
}

const periods = ['1-3 дня', '4-7 дней', '8-15 дней', '16-30 дней', '31+ дней'];
const values = priceData.values || [];

return [{
  json: {
    ...priceData,
    // Формируем структуру price_values
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
      }))
    }
  }
}];`
    }
  };
  
  // Создаем ноду для сохранения цен
  const savePricesNode = {
    name: 'Save Prices',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.4,
    position: [enrichWithCarIdNode.position[0] + 200, enrichWithCarIdNode.position[1]],
    id: `save-prices-${Date.now()}`,
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
          price_values: '={{ $json.price_values }}'
        },
        matchingColumns: ['car_id', 'season_id'],
        schema: []
      }
    },
    credentials: saveSnapshotNode.credentials
  };
  
  // Проверяем, не существуют ли уже ноды
  const existingSplitNode = nodes.find(n => n.name === 'Split Cars and Prices');
  const existingFindCarIdNode = nodes.find(n => n.name === 'Find Car ID');
  const existingMergeCarIdNode = nodes.find(n => n.name === 'Merge Car ID');
  const existingFormatNode = nodes.find(n => n.name === 'Format Price Values');
  const existingSavePricesNode = nodes.find(n => n.name === 'Save Prices');
  
  // Добавляем только новые ноды
  if (!existingSplitNode) nodes.push(splitNode);
  if (!existingFindCarIdNode) nodes.push(findCarIdNode);
  if (!existingMergeCarIdNode) nodes.push(mergeCarIdNode);
  if (!existingFormatNode) nodes.push(enrichWithCarIdNode);
  if (!existingSavePricesNode) nodes.push(savePricesNode);
  
  // Обновляем connections
  // Удаляем старую connection от Merge & Process к Save Snapshot
  if (connections['Merge & Process']) {
    delete connections['Merge & Process'];
  }
  
  // Добавляем новые connections
  connections['Merge & Process'] = {
    main: [[{
      node: 'Split Cars and Prices',
      type: 'main',
      index: 0
    }]]
  };
  
  connections['Split Cars and Prices'] = {
    main: [
      [{
        node: 'Find Car ID',
        type: 'main',
        index: 0
      }],
      [{
        node: 'Save Snapshot',
        type: 'main',
        index: 0
      }]
    ]
  };
  
  connections['Find Car ID'] = {
    main: [[{
      node: 'Merge Car ID',
      type: 'main',
      index: 0
    }]]
  };
  
  connections['Merge Car ID'] = {
    main: [[{
      node: 'Format Price Values',
      type: 'main',
      index: 0
    }]]
  };
  
  connections['Format Price Values'] = {
    main: [[{
      node: 'Save Prices',
      type: 'main',
      index: 0
    }]]
  };
  
  console.log('💾 Обновляю workflow...');
  
  // Обновляем workflow
  const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: workflow.name,
      nodes: nodes,
      connections: connections,
      settings: workflow.settings || { executionOrder: 'v1' }
    })
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.status} - ${errorText}`);
  }
  
  console.log('✅ Workflow обновлен!');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
}

updateWorkflow().catch(console.error);

