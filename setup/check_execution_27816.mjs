import https from 'https';
import postgres from 'postgres';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
const EXECUTION_ID = '27816';
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = postgres(CONNECTION_STRING, {
  max: 1,
  ssl: { rejectUnauthorized: false }
});

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

async function checkExecution27816() {
  console.log('🔍 Проверка execution #27816...\n');
  
  // 1. Получаем execution
  console.log('1️⃣ Получаю данные execution...');
  const execution = await apiRequest('GET', `/api/v1/executions/${EXECUTION_ID}?includeData=true`);
  const execData = execution.data || execution;
  
  if (!execData) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Execution получен`);
  console.log(`   Статус: ${execData.status}`);
  console.log(`   Начало: ${execData.startedAt}`);
  console.log(`   Конец: ${execData.stoppedAt || 'не завершен'}`);
  console.log(`   Длительность: ${execData.duration}ms\n`);
  
  if (execData.status === 'error') {
    console.log('❌ ОШИБКА В EXECUTION!\n');
    
    // Проверяем ошибки в нодах
    const nodes = execData.nodes || {};
    const nodeNames = Object.keys(nodes);
    
    console.log('2️⃣ Поиск нод с ошибками...\n');
    
    for (const nodeName of nodeNames) {
      const node = nodes[nodeName];
      if (node.status === 'error') {
        console.log(`   ❌ Нода "${nodeName}": ОШИБКА`);
        console.log(`      Execution time: ${node.executionTime}ms`);
        console.log(`      Items input: ${node.itemsInput}`);
        console.log(`      Items output: ${node.itemsOutput}`);
        
        // Пытаемся получить детали ошибки
        if (node.data && node.data.error) {
          console.log(`      Ошибка: ${JSON.stringify(node.data.error, null, 2)}`);
        }
        
        // Проверяем output на наличие ошибок
        if (node.data && node.data.output) {
          const output = node.data.output[0] || [];
          if (output.length > 0 && output[0].json && output[0].json.error) {
            console.log(`      Детали: ${JSON.stringify(output[0].json.error, null, 2)}`);
          }
        }
        
        console.log('');
      }
    }
    
    // Проверяем общую ошибку execution
    if (execData.error) {
      console.log('3️⃣ Общая ошибка execution:\n');
      console.log(`   ${JSON.stringify(execData.error, null, 2)}\n`);
    }
  } else {
    console.log('✅ Execution завершен успешно\n');
  }
  
  // 2. Анализируем ключевые ноды
  console.log('4️⃣ Анализ ключевых нод...\n');
  
  const nodes = execData.nodes || {};
  
  // Normalize Cars
  const normalizeCars = nodes['Normalize Cars'];
  if (normalizeCars) {
    console.log(`   Normalize Cars: ${normalizeCars.status}`);
    console.log(`      Items output: ${normalizeCars.itemsOutput}`);
    if (normalizeCars.status === 'error') {
      console.log(`      ❌ ОШИБКА в ноде Normalize Cars!`);
    }
  } else {
    console.log(`   ⚠️  Normalize Cars: нет данных`);
  }
  
  // Split Cars and Prices
  const splitNode = nodes['Split Cars and Prices'];
  if (splitNode) {
    console.log(`\n   Split Cars and Prices: ${splitNode.status}`);
    console.log(`      Items output: ${splitNode.itemsOutput}`);
    if (splitNode.status === 'error') {
      console.log(`      ❌ ОШИБКА в ноде Split Cars and Prices!`);
    }
  } else {
    console.log(`   ⚠️  Split Cars and Prices: нет данных`);
  }
  
  // Save Prices
  const savePrices = nodes['Save Prices'];
  if (savePrices) {
    console.log(`\n   Save Prices: ${savePrices.status}`);
    console.log(`      Items output: ${savePrices.itemsOutput}`);
    if (savePrices.status === 'error') {
      console.log(`      ❌ ОШИБКА в ноде Save Prices!`);
    }
  } else {
    console.log(`   ⚠️  Save Prices: нет данных`);
  }
  
  // Save Cars
  const saveCars = nodes['Save Cars'];
  if (saveCars) {
    console.log(`\n   Save Cars: ${saveCars.status}`);
    console.log(`      Items output: ${saveCars.itemsOutput}`);
    if (saveCars.status === 'error') {
      console.log(`      ❌ ОШИБКА в ноде Save Cars!`);
    }
  } else {
    console.log(`   ⚠️  Save Cars: нет данных`);
  }
  
  // 3. Проверяем БД
  console.log('\n\n5️⃣ Проверка данных в БД...\n');
  
  if (execData.startedAt && execData.stoppedAt) {
    const executionStart = new Date(execData.startedAt);
    const executionEnd = new Date(execData.stoppedAt);
    
    // Проверяем цены
    const pricesInDB = await sql`
      SELECT COUNT(*) as count
      FROM car_prices cp
      WHERE cp.created_at >= ${executionStart}
        AND cp.created_at <= ${executionEnd}
    `;
    
    console.log(`   Цен сохранено: ${pricesInDB[0].count}`);
    
    // Проверяем машины
    const carsInDB = await sql`
      SELECT COUNT(*) as count
      FROM cars c
      WHERE c.updated_at >= ${executionStart}
        AND c.updated_at <= ${executionEnd}
    `;
    
    console.log(`   Машин обновлено: ${carsInDB[0].count}`);
  }
  
  console.log('\n✅ Проверка завершена!\n');
  
  await sql.end();
}

checkExecution27816()
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

