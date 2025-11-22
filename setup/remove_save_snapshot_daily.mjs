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

async function removeSaveSnapshot() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Находим ноду "Save Snapshot"
  const saveSnapshotNode = workflow.nodes.find(n => n.id === '1de4f8c4-98e9-4f7d-bcff-913329229b6f');
  if (!saveSnapshotNode) {
    console.log('⚠️  Нода "Save Snapshot" не найдена, возможно уже удалена\n');
    return;
  }
  
  console.log('🔧 Удаляю ноду "Save Snapshot"...');
  
  // Удаляем ноду из массива nodes
  workflow.nodes = workflow.nodes.filter(n => n.id !== '1de4f8c4-98e9-4f7d-bcff-913329229b6f');
  console.log('✅ Нода "Save Snapshot" удалена из nodes\n');
  
  // Обновляем connections
  console.log('🔧 Обновляю connections...');
  
  // Has Data? False branch (есть данные) → Remove Price Values (вместо Save Snapshot)
  if (workflow.connections['Has Data?']) {
    workflow.connections['Has Data?'] = {
      main: [
        [
          { node: 'Format Result', type: 'main', index: 0 }
        ],
        [
          { node: 'Remove Price Values', type: 'main', index: 0 }
        ]
      ]
    };
  }
  
  // Удаляем connections для Save Snapshot
  delete workflow.connections['Save Snapshot'];
  
  console.log('✅ Connections обновлены\n');
  console.log('📋 Изменения:');
  console.log('  ✅ Нода "Save Snapshot" удалена');
  console.log('  ✅ Has Data? (False - есть данные) → Remove Price Values → Save Cars');
  console.log('  ✅ Поток упрощен, данные сохраняются напрямую в cars\n');
  
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
  console.log('📋 Итоговая структура:');
  console.log('  Daily Trigger → 4 филиала → Merge All Branches');
  console.log('  → Normalize Cars → Split Cars and Prices');
  console.log('    ├─ True (цены): Find Car ID → Merge Car ID → Format Price Values → Save Prices → Merge Results');
  console.log('    └─ False (машины): Has Data? → Remove Price Values → Save Cars → Merge Results');
  console.log('  → Merge Results → Format Result → If Error → Send Alert / Success');
  console.log('\n✅ Готово!');
}

removeSaveSnapshot()
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

