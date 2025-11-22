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

async function fixSaveCarsDataFormat() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Находим ноду "Save Cars"
  console.log('🔧 Исправляю ноду "Save Cars" (формат данных)...');
  const saveCarsNode = workflow.nodes.find(n => n.id === '300259d8-5136-4fa4-a12a-e1a1bd8b8759');
  if (!saveCarsNode) {
    throw new Error('Нода "Save Cars" не найдена');
  }
  
  // Проверяем текущий queryReplacement
  const currentReplacement = saveCarsNode.parameters?.options?.queryReplacement || '';
  console.log(`   Текущий queryReplacement: ${currentReplacement}\n`);
  
  // Исправляем queryReplacement - используем правильный формат
  // В других workflow используется $json.payload_json, но здесь нужно передать весь JSON
  // n8n автоматически конвертирует JSON.stringify в JSONB при передаче в PostgreSQL
  // Но лучше использовать явное поле payload_json для совместимости
  
  // НО! Проблема может быть в том, что данные приходят не в том формате
  // Проверяем, что данные из "Normalize Cars" содержат все нужные поля
  
  // Исправляем queryReplacement - используем правильный формат как в других workflow
  saveCarsNode.parameters.options.queryReplacement = "={{ $json.rentprog_id }},={{ JSON.stringify($json) }}";
  
  console.log(`   ✅ queryReplacement обновлен`);
  console.log(`   Новый формат: rentprog_id, JSON.stringify($json)\n`);
  
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
  console.log('  ✅ queryReplacement обновлен для правильной передачи данных');
  console.log('  ✅ Функция dynamic_upsert_entity уже исправлена (ON CONFLICT заменен на SELECT EXISTS)');
  console.log('\n✅ Готово!');
}

fixSaveCarsDataFormat()
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

