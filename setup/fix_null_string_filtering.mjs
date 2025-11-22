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

async function fixNullStringFiltering() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // 1. Исправляем ноду "Merge & Process" - добавляем фильтрацию строки "null"
  console.log('🔧 1. Исправляю ноду "Merge & Process" (добавляю фильтрацию строки "null")...');
  const mergeProcessNode = workflow.nodes.find(n => n.id === '37a107c9-4431-44ac-88c6-3dd1e51951b3');
  if (!mergeProcessNode) {
    throw new Error('Нода "Merge & Process" не найдена');
  }
  
  // Обновляем функцию safeValue - добавляем проверку на строку "null"
  const currentCode = mergeProcessNode.parameters.jsCode;
  const updatedCode = currentCode.replace(
    `const safeValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;  // Не передаем в SQL, чтобы не затереть существующие данные
  }
  return value;
};`,
    `const safeValue = (value) => {
  if (value === undefined || value === null || value === '' || value === 'null') {
    return undefined;  // Не передаем в SQL, чтобы не затереть существующие данные
  }
  return value;
};`
  );
  
  mergeProcessNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Merge & Process" обновлена с фильтрацией строки "null"\n');
  
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
  console.log('  ✅ Функция safeValue теперь фильтрует строку "null"');
  console.log('\n⚠️  ВАЖНО: Также нужно обновить функцию dynamic_upsert_entity в БД!');
  console.log('   Создайте миграцию для добавления проверки на строку "null"');
}

fixNullStringFiltering()
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

