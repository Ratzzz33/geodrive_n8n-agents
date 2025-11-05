import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

console.log('\n🔧 Исправление connections в workflow...\n');

function getWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    };

    const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).data || JSON.parse(data));
        } else {
          reject(new Error(`Get failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function updateWorkflow(workflow) {
  return new Promise((resolve, reject) => {
    const cleanWorkflow = {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
      pinData: workflow.pinData
    };

    const data = JSON.stringify(cleanWorkflow);
    const options = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          console.error('Response:', responseData);
          reject(new Error(`Update failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fixConnections() {
  try {
    console.log('1️⃣ Получение workflow...');
    const workflow = await getWorkflow();
    console.log(`   ✓ ${workflow.nodes.length} нод\n`);

    console.log('2️⃣ Исправление connections...');
    
    // Текущий connection: Insert Fetched Entity → [Respond Success, Process Nested]
    // Нужно: Insert Fetched Entity → Process Nested (только)
    
    const currentConnection = workflow.connections["Insert Fetched Entity"];
    console.log('   Текущий:', JSON.stringify(currentConnection, null, 2));

    // Оставляем только Process Nested
    workflow.connections["Insert Fetched Entity"] = {
      main: [[
        { node: "Process Nested", type: "main", index: 0 }
      ]]
    };

    console.log('   Новый:', JSON.stringify(workflow.connections["Insert Fetched Entity"], null, 2));
    console.log('   ✓ Insert Fetched Entity → Process Nested\n');

    // Очищаем ноды от лишних полей
    workflow.nodes = workflow.nodes.map(node => ({
      parameters: node.parameters,
      id: node.id,
      name: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      position: node.position,
      ...(node.credentials && { credentials: node.credentials }),
      ...(node.webhookId && { webhookId: node.webhookId })
    }));

    console.log('3️⃣ Обновление workflow...');
    await updateWorkflow(workflow);
    console.log('   ✓ Готово!\n');

    console.log('✅ Connections исправлены!');
    console.log('   Теперь поток: Insert Fetched → Process Nested → Upsert Car → Upsert Client → Merge → Update FKeys → Respond\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

fixConnections();

