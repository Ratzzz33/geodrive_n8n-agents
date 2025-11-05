import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

console.log('\n🔄 Обновление workflow для использования dynamic_upsert_entity...\n');

const getWorkflow = () => {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    };

    const req = https.request(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const parsed = JSON.parse(data);
          resolve(parsed.data || parsed);
        } else {
          reject(new Error(`Get failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const updateWorkflow = (workflow) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    });

    const options = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Update failed: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

async function updateWorkflowNodes() {
  try {
    console.log('1️⃣ Получение текущего workflow...');
    const workflow = await getWorkflow();
    console.log(`   ✓ Получен: ${workflow.nodes.length} нод\n`);

    console.log('2️⃣ Обновление нод для использования dynamic_upsert_entity...\n');

    // Обновляем "Insert Entity" (для create)
    const insertEntityNode = workflow.nodes.find(n => n.id === 'insert-entity');
    if (insertEntityNode) {
      console.log('   📝 Обновление "Insert Entity"...');
      insertEntityNode.parameters.query = `-- Динамический upsert с автосозданием колонок
SELECT * FROM dynamic_upsert_entity(
  $1::TEXT,  -- table_name
  $2::TEXT,  -- rentprog_id  
  $3::JSONB  -- data
);`;
      insertEntityNode.parameters.options.queryReplacement = '={{ $json.table_name }},={{ $json.rentprog_id }},={{ $json.payload_json }}';
      console.log('   ✓ "Insert Entity" обновлен');
    }

    // Обновляем "Insert Fetched Entity" (для update когда сущность не найдена)
    const insertFetchedNode = workflow.nodes.find(n => n.id === 'insert-fetched');
    if (insertFetchedNode) {
      console.log('   📝 Обновление "Insert Fetched Entity"...');
      insertFetchedNode.parameters.query = `-- Динамический upsert с автосозданием колонок
SELECT * FROM dynamic_upsert_entity(
  $1::TEXT,  -- table_name  
  $2::TEXT,  -- rentprog_id
  $3::JSONB  -- data
);`;
      // Нужно добавить table_name в Extract Result
      insertFetchedNode.parameters.options.queryReplacement = '={{ $json.table_name }},={{ $json.rentprog_id }},={{ $json.data_json }}';
      console.log('   ✓ "Insert Fetched Entity" обновлен');
    }

    // Обновляем "Extract Result" чтобы добавить table_name
    const extractResultNode = workflow.nodes.find(n => n.id === 'extract-result');
    if (extractResultNode) {
      console.log('   📝 Обновление "Extract Result"...');
      extractResultNode.parameters.jsCode = `// Извлекаем первый результат из поиска
const results = Array.isArray($json) ? $json : [$json];
const found = results.find(item => item.id == $('Get RentProg Token').first().json.rentprog_id);

if (!found) {
  throw new Error('Entity not found in RentProg');
}

const data = $('Get RentProg Token').first().json;

// Определяем table_name
const tableMap = {
  'car': 'cars',
  'client': 'clients',
  'booking': 'bookings'
};

const tableName = tableMap[data.entity_type] || data.entity_type + 's';

return {
  json: {
    entity_type: data.entity_type,
    rentprog_id: data.rentprog_id,
    table_name: tableName,
    data: found,
    data_json: JSON.stringify(found)
  }
};`;
      console.log('   ✓ "Extract Result" обновлен');
    }

    console.log('\n3️⃣ Сохранение обновленного workflow...');
    await updateWorkflow(workflow);
    console.log('   ✓ Workflow обновлен\n');

    console.log('✅ Workflow успешно обновлен!');
    console.log(`\n📍 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    console.log('\n💡 Теперь при получении новых полей от RentProg:');
    console.log('   1. Функция dynamic_upsert_entity автоматически создаст колонки');
    console.log('   2. Определит подходящий тип данных (TEXT/INTEGER/JSONB/etc)');
    console.log('   3. Запишет данные без ошибок');
    console.log('   4. Вернет информацию о добавленных колонках\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

updateWorkflowNodes();

