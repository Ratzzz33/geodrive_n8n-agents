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

async function removeSaveSnapshotNode() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Находим ноду "Save Snapshot"
  const saveSnapshotNode = workflow.nodes.find(n => n.name === 'Save Snapshot');
  if (!saveSnapshotNode) {
    throw new Error('Нода "Save Snapshot" не найдена');
  }
  
  console.log('🗑️  Удаляю ноду "Save Snapshot"...');
  
  // Удаляем ноду из массива nodes
  workflow.nodes = workflow.nodes.filter(n => n.name !== 'Save Snapshot');
  
  // Обновляем connections:
  // 1. Удаляем связи от "Split Cars and Prices" к "Save Snapshot"
  // 2. Добавляем связь от "Split Cars and Prices" напрямую к "Save to Cars"
  
  const splitNode = workflow.connections['Split Cars and Prices'];
  if (splitNode && splitNode.main && splitNode.main.length >= 2) {
    // False branch (машины) - было: Save Snapshot, теперь: Save to Cars
    const falseBranch = splitNode.main[1];
    const saveSnapshotIndex = falseBranch.findIndex(conn => conn.node === 'Save Snapshot');
    
    if (saveSnapshotIndex !== -1) {
      // Заменяем "Save Snapshot" на "Save to Cars"
      falseBranch[saveSnapshotIndex] = {
        node: 'Save to Cars',
        type: 'main',
        index: 0
      };
    } else {
      // Если связи нет, добавляем новую
      falseBranch.push({
        node: 'Save to Cars',
        type: 'main',
        index: 0
      });
    }
  }
  
  // Удаляем connections от "Save Snapshot"
  delete workflow.connections['Save Snapshot'];
  
  console.log('✅ Нода "Save Snapshot" удалена, connections обновлены\n');
  
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
  console.log('  ✅ Нода "Save Snapshot" удалена');
  console.log('  ✅ Connections обновлены: Split Cars and Prices → Save to Cars');
  console.log('  ✅ Данные теперь сохраняются только в основную таблицу cars');
  console.log('\n🎉 Готово!');
}

removeSaveSnapshotNode()
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

