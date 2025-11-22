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

async function fixDailyPricesConnections() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Исправляем connections
  console.log('🔧 Исправляю connections...\n');
  
  // Normalize Cars → Split Cars and Prices
  workflow.connections['Normalize Cars'] = {
    main: [[
      { node: 'Split Cars and Prices', type: 'main', index: 0 }
    ]]
  };
  
  // Split Cars and Prices:
  // - True branch (цены) → Find Car ID
  // - False branch (машины) → Has Data?
  workflow.connections['Split Cars and Prices'] = {
    main: [
      [
        { node: 'Find Car ID', type: 'main', index: 0 }
      ],
      [
        { node: 'Has Data?', type: 'main', index: 0 }
      ]
    ]
  };
  
  // Find Car ID → Merge Car ID
  workflow.connections['Find Car ID'] = {
    main: [[
      { node: 'Merge Car ID', type: 'main', index: 0 }
    ]]
  };
  
  // Merge Car ID → Format Price Values
  workflow.connections['Merge Car ID'] = {
    main: [[
      { node: 'Format Price Values', type: 'main', index: 0 }
    ]]
  };
  
  // Format Price Values → Save Prices
  workflow.connections['Format Price Values'] = {
    main: [[
      { node: 'Save Prices', type: 'main', index: 0 }
    ]]
  };
  
  // Save Prices → Format Result (параллельно с Save Cars)
  workflow.connections['Save Prices'] = {
    main: [[
      { node: 'Format Result', type: 'main', index: 0 }
    ]]
  };
  
  // Has Data? остается как есть:
  // - True branch (нет данных) → Format Result
  // - False branch (есть данные) → Save Snapshot
  
  // Save Snapshot → Remove Price Values → Save Cars → Format Result
  
  console.log('✅ Connections исправлены\n');
  
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
  console.log('📋 Исправленные connections:');
  console.log('  ✅ Normalize Cars → Split Cars and Prices');
  console.log('  ✅ Split Cars and Prices (True - цены) → Find Car ID');
  console.log('  ✅ Split Cars and Prices (False - машины) → Has Data?');
  console.log('  ✅ Find Car ID → Merge Car ID → Format Price Values → Save Prices → Format Result');
  console.log('\n✅ Готово!');
}

fixDailyPricesConnections()
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

