#!/usr/bin/env node

/**
 * Исправление workflow активных и новых броней - добавление client_id
 * 
 * Что делаем:
 * 1. В "Process All Bookings" - добавляем client_id в результат
 * 2. В "Save to DB" - добавляем client_id в маппинг колонок
 */

import https from 'https';

const N8N_HOST = 'n8n.rentflow.rentals';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';

console.log('🔧 Исправление workflow активных и новых броней...\n');

// Получаем текущий workflow
const getWorkflow = () => new Promise((resolve, reject) => {
  const options = {
    hostname: N8N_HOST,
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  };

  https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        resolve(JSON.parse(data));
      } else {
        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      }
    });
  }).on('error', reject).end();
});

// Обновляем workflow
const updateWorkflow = (workflow) => new Promise((resolve, reject) => {
  const body = JSON.stringify(workflow);
  
  const options = {
    hostname: N8N_HOST,
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        resolve(JSON.parse(data));
      } else {
        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      }
    });
  });

  req.on('error', reject);
  req.write(body);
  req.end();
});

try {
  // 1. Получаем workflow
  const response = await getWorkflow();
  const workflow = response.data;
  
  console.log('✅ Получен workflow:', workflow.name);
  console.log(`   Nodes: ${workflow.nodes.length}`);
  
  // 2. Находим ноду "Process All Bookings"
  const processNode = workflow.nodes.find(n => n.name === 'Process All Bookings');
  if (!processNode) {
    throw new Error('Нода "Process All Bookings" не найдена');
  }
  
  console.log('\n📝 Обновляю ноду "Process All Bookings"...');
  
  // Проверяем, есть ли уже client_id в коде
  const currentCode = processNode.parameters.jsCode;
  if (currentCode.includes('client_id:')) {
    console.log('⚠️  client_id уже есть в коде ноды');
  } else {
    // Добавляем извлечение client_id после car_id
    const updatedCode = currentCode.replace(
      /const carId = carIdMap\.get\(normalizeCode\(carCode\)\) \|\| null;/,
      `const carId = carIdMap.get(normalizeCode(carCode)) || null;
    
    // ✅ Извлекаем client_id из RentProg
    const rentprogClientIdRaw = attrs.client_id ?? null;
    const rentprogClientId = rentprogClientIdRaw !== null && rentprogClientIdRaw !== undefined
      ? String(rentprogClientIdRaw)
      : null;`
    );
    
    // Добавляем client_id в результат после car_id
    const finalCode = updatedCode.replace(
      /car_id: carId,/,
      `car_id: carId,
        rentprog_client_id: rentprogClientId,`
    );
    
    processNode.parameters.jsCode = finalCode;
    console.log('✅ Добавлено извлечение client_id из attrs.client_id');
  }
  
  // 3. Находим ноду "Save to DB"
  const saveNode = workflow.nodes.find(n => n.name === 'Save to DB');
  if (!saveNode) {
    throw new Error('Нода "Save to DB" не найдена');
  }
  
  console.log('\n📝 Обновляю ноду "Save to DB"...');
  
  // Проверяем, есть ли уже client_id в маппинге
  const columns = saveNode.parameters.columns.value;
  if (columns.client_id) {
    console.log('⚠️  client_id уже есть в маппинге колонок');
  } else {
    // Добавляем client_id в маппинг после car_id
    const updatedColumns = {};
    for (const [key, value] of Object.entries(columns)) {
      updatedColumns[key] = value;
      if (key === 'car_id') {
        updatedColumns.client_id = '={{ $json.rentprog_client_id }}';
      }
    }
    
    saveNode.parameters.columns.value = updatedColumns;
    console.log('✅ Добавлено поле client_id в маппинг колонок');
  }
  
  // 4. Обновляем workflow
  console.log('\n🚀 Обновляю workflow на сервере...');
  
  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData,
    active: workflow.active
  };
  
  await updateWorkflow(updatePayload);
  
  console.log('\n✅ ГОТОВО! Workflow обновлен успешно');
  console.log(`\n🔗 Проверьте: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\n📋 Изменения:');
  console.log('   1. ✅ В "Process All Bookings" добавлено извлечение client_id');
  console.log('   2. ✅ В "Save to DB" добавлено поле client_id в маппинг');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

