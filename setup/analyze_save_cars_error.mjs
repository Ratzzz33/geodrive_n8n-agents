import https from 'https';
import postgres from 'postgres';

const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const N8N_HOST = 'https://n8n.rentflow.rentals';
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

async function analyzeSaveCarsError() {
  console.log('🔍 Детальный анализ ошибки в ноде "Save Cars"...\n');
  
  // 1. Получаем последнее execution
  console.log('1️⃣ Получаю последнее execution...');
  const executions = await apiRequest('GET', '/api/v1/executions?workflowId=ihRLR0QCJySx319b&limit=1');
  const execList = executions.data || executions;
  
  if (!execList || !execList.data || execList.data.length === 0) {
    throw new Error('Не найдено executions');
  }
  
  const latestExecution = execList.data[0];
  const executionId = latestExecution.id;
  
  console.log(`✅ Последний execution: #${executionId}`);
  console.log(`   Статус: ${latestExecution.status}\n`);
  
  // 2. Получаем детальные данные execution
  console.log('2️⃣ Получаю детальные данные execution...');
  const execution = await apiRequest('GET', `/api/v1/executions/${executionId}?includeData=true&mode=filtered&nodeNames[]=Save Cars&nodeNames[]=Normalize Cars&nodeNames[]=Has Data?&itemsLimit=2`);
  const execData = execution.data || execution;
  
  if (!execData) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Execution получен\n`);
  
  // 3. Анализируем ноду "Save Cars"
  console.log('3️⃣ Анализ ноды "Save Cars"...\n');
  
  const saveCarsNode = execData.nodes?.['Save Cars'];
  if (!saveCarsNode) {
    console.log('   ⚠️  Нода "Save Cars" не найдена в execution');
    return;
  }
  
  console.log(`   Статус: ${saveCarsNode.status}`);
  console.log(`   Execution time: ${saveCarsNode.executionTime}ms`);
  console.log(`   Items input: ${saveCarsNode.itemsInput}`);
  console.log(`   Items output: ${saveCarsNode.itemsOutput}`);
  
  if (saveCarsNode.status === 'error') {
    console.log(`\n   ❌ ОШИБКА:`);
    if (saveCarsNode.error) {
      console.log(`   Сообщение: ${saveCarsNode.error.message || JSON.stringify(saveCarsNode.error)}`);
      if (saveCarsNode.error.description) {
        console.log(`   Описание: ${saveCarsNode.error.description.substring(0, 500)}...`);
      }
    }
    
    // Проверяем входные данные
    if (saveCarsNode.data && saveCarsNode.data.input) {
      const input = saveCarsNode.data.input[0] || [];
      console.log(`\n   Входных элементов: ${input.length}`);
      if (input.length > 0) {
        console.log(`   Пример входных данных (первый элемент):`);
        const sample = input[0].json || {};
        console.log(`   - rentprog_id: ${sample.rentprog_id || 'НЕТ!'}`);
        console.log(`   - Ключи в JSON: ${Object.keys(sample).slice(0, 10).join(', ')}...`);
        console.log(`   - Полный JSON (первые 500 символов):`);
        console.log(`   ${JSON.stringify(sample, null, 2).substring(0, 500)}...`);
      }
    }
  }
  
  // 4. Проверяем ноду "Normalize Cars" - что она передает
  console.log('\n4️⃣ Анализ ноды "Normalize Cars" (что передается в "Save Cars")...\n');
  
  const normalizeCarsNode = execData.nodes?.['Normalize Cars'];
  if (normalizeCarsNode) {
    console.log(`   Статус: ${normalizeCarsNode.status}`);
    console.log(`   Items output: ${normalizeCarsNode.itemsOutput}`);
    
    if (normalizeCarsNode.data && normalizeCarsNode.data.output) {
      const output = normalizeCarsNode.data.output[0] || [];
      console.log(`   Выходных элементов: ${output.length}`);
      if (output.length > 0) {
        const sample = output[0].json || {};
        console.log(`   Пример выходных данных (первый элемент):`);
        console.log(`   - rentprog_id: ${sample.rentprog_id || 'НЕТ!'}`);
        console.log(`   - Ключи: ${Object.keys(sample).slice(0, 15).join(', ')}...`);
      }
    }
  }
  
  // 5. Проверяем структуру функции dynamic_upsert_entity в БД
  console.log('\n5️⃣ Проверка функции dynamic_upsert_entity в БД...\n');
  
  try {
    const functionDef = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'dynamic_upsert_entity'
        AND pronargs = 3
      ORDER BY oid DESC
      LIMIT 1
    `;
    
    if (functionDef.length > 0) {
      const def = functionDef[0].definition;
      console.log(`   ✅ Функция найдена`);
      console.log(`   Параметры: p_table_name TEXT, p_rentprog_id TEXT, p_data JSONB`);
      
      // Проверяем, что функция ожидает
      if (def.includes('INSERT INTO')) {
        console.log(`   ✅ Функция содержит INSERT`);
      }
      if (def.includes('ON CONFLICT')) {
        console.log(`   ⚠️  Функция содержит ON CONFLICT - может быть проблема!`);
        console.log(`   Детали ON CONFLICT:`);
        const conflictMatch = def.match(/ON CONFLICT[^;]+/);
        if (conflictMatch) {
          console.log(`   ${conflictMatch[0].substring(0, 200)}...`);
        }
      }
    } else {
      console.log(`   ❌ Функция не найдена!`);
    }
  } catch (error) {
    console.log(`   ❌ Ошибка при проверке функции: ${error.message}`);
  }
  
  // 6. Проверяем текущую конфигурацию ноды "Save Cars" в workflow
  console.log('\n6️⃣ Проверка конфигурации ноды "Save Cars" в workflow...\n');
  
  const workflowData = await apiRequest('GET', '/api/v1/workflows/ihRLR0QCJySx319b');
  const workflow = workflowData.data || workflowData;
  
  if (workflow && workflow.nodes) {
    const saveCarsNodeConfig = workflow.nodes.find(n => n.id === '300259d8-5136-4fa4-a12a-e1a1bd8b8759');
    if (saveCarsNodeConfig) {
      console.log(`   ✅ Нода найдена в workflow`);
      console.log(`   Операция: ${saveCarsNodeConfig.parameters?.operation || 'нет'}`);
      console.log(`   Query: ${(saveCarsNodeConfig.parameters?.query || '').substring(0, 200)}...`);
      console.log(`   Query Replacement: ${saveCarsNodeConfig.parameters?.options?.queryReplacement || 'нет'}`);
      
      // Проверяем формат queryReplacement
      const queryReplacement = saveCarsNodeConfig.parameters?.options?.queryReplacement;
      if (queryReplacement) {
        console.log(`\n   Анализ queryReplacement:`);
        console.log(`   ${queryReplacement}`);
        
        // Проверяем, правильно ли передаются параметры
        if (queryReplacement.includes('$json.rentprog_id')) {
          console.log(`   ✅ Использует $json.rentprog_id`);
        } else {
          console.log(`   ⚠️  НЕ использует $json.rentprog_id - может быть проблема!`);
        }
        
        if (queryReplacement.includes('JSON.stringify')) {
          console.log(`   ✅ Использует JSON.stringify`);
        } else {
          console.log(`   ⚠️  НЕ использует JSON.stringify - может быть проблема!`);
        }
      }
    }
  }
  
  // 7. Тестируем функцию dynamic_upsert_entity напрямую
  console.log('\n7️⃣ Тестирование функции dynamic_upsert_entity напрямую...\n');
  
  try {
    const testResult = await sql`
      SELECT * FROM dynamic_upsert_entity(
        'cars'::TEXT,
        'TEST123'::TEXT,
        '{"rentprog_id": "TEST123", "car_name": "Test Car", "code": "TEST"}'::JSONB
      )
    `;
    
    console.log(`   ✅ Функция работает`);
    console.log(`   Результат: ${JSON.stringify(testResult[0])}`);
    
    // Удаляем тестовую запись
    await sql`DELETE FROM external_refs WHERE external_id = 'TEST123'`;
    await sql`DELETE FROM cars WHERE rentprog_id = 'TEST123'`;
    console.log(`   ✅ Тестовая запись удалена`);
  } catch (error) {
    console.log(`   ❌ Ошибка при тестировании функции: ${error.message}`);
    console.log(`   Stack: ${error.stack?.substring(0, 300)}...`);
  }
  
  console.log('\n✅ Анализ завершен!\n');
  
  await sql.end();
}

analyzeSaveCarsError()
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

