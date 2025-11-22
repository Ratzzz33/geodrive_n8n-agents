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

async function fixSplitCarsPricesTypeError() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Исправляем ноду "Normalize Cars" - преобразуем price_id в строку
  console.log('🔧 Исправляю ноду "Normalize Cars" (преобразование price_id в строку)...');
  const normalizeNode = workflow.nodes.find(n => n.id === 'b28f2471-e845-47dc-aa9c-95da0f075a06');
  if (!normalizeNode) {
    throw new Error('Нода "Normalize Cars" не найдена');
  }
  
  // Находим место, где добавляем price_id и преобразуем его в строку
  const currentCode = normalizeNode.parameters.jsCode || '';
  
  // Заменяем price_id: priceId на price_id: String(priceId)
  const updatedCode = currentCode.replace(
    /price_id:\s*priceId/g,
    'price_id: String(priceId)'
  );
  
  if (updatedCode === currentCode) {
    // Если не нашлось, ищем другой паттерн
    const updatedCode2 = currentCode.replace(
      /price_id:\s*price\.id/g,
      'price_id: String(price.id)'
    );
    
    if (updatedCode2 === currentCode) {
      // Если все еще не нашлось, добавляем преобразование явно
      // Ищем строку где создается priceResults.push
      const priceResultsPattern = /priceResults\.push\(\s*\{\s*json:\s*\{/;
      if (priceResultsPattern.test(currentCode)) {
        // Добавляем преобразование price_id в строку перед добавлением в priceResults
        const updatedCode3 = currentCode.replace(
          /(\s+price_id:\s*)(priceId|price\.id)/g,
          '$1String($2)'
        );
        
        normalizeNode.parameters.jsCode = updatedCode3;
        console.log('✅ Нода "Normalize Cars" обновлена (преобразование price_id в строку)\n');
      } else {
        throw new Error('Не удалось найти место для исправления price_id');
      }
    } else {
      normalizeNode.parameters.jsCode = updatedCode2;
      console.log('✅ Нода "Normalize Cars" обновлена (преобразование price.id в строку)\n');
    }
  } else {
    normalizeNode.parameters.jsCode = updatedCode;
    console.log('✅ Нода "Normalize Cars" обновлена (преобразование priceId в строку)\n');
  }
  
  // Также исправляем ноду "Split Cars and Prices" - меняем тип проверки
  console.log('🔧 Исправляю ноду "Split Cars and Prices" (изменение типа проверки)...');
  const splitNode = workflow.nodes.find(n => n.id === 'split-cars-prices-daily');
  if (!splitNode) {
    throw new Error('Нода "Split Cars and Prices" не найдена');
  }
  
  // Меняем тип проверки с string на number или убираем строгую проверку типа
  if (splitNode.parameters.conditions && splitNode.parameters.conditions.conditions) {
    const condition = splitNode.parameters.conditions.conditions[0];
    if (condition && condition.operator) {
      // Меняем тип оператора с string на number или используем общий тип
      // Лучше использовать проверку на существование значения, а не на тип
      condition.operator = {
        type: "number",  // Меняем на number, так как price_id может быть числом
        operation: "isNotEmpty"
      };
      
      // Или лучше использовать проверку на существование без строгой типизации
      // Но для этого нужно изменить leftValue, чтобы преобразовать в строку
      condition.leftValue = "={{ String($json.price_id || '') }}";
      condition.operator = {
        type: "string",
        operation: "isNotEmpty"
      };
      
      console.log('✅ Нода "Split Cars and Prices" обновлена (преобразование price_id в строку в условии)\n');
    }
  }
  
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
  console.log('  ✅ price_id преобразуется в строку в ноде "Normalize Cars"');
  console.log('  ✅ Условие в "Split Cars and Prices" преобразует price_id в строку перед проверкой');
  console.log('\n✅ Готово!');
}

fixSplitCarsPricesTypeError()
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

