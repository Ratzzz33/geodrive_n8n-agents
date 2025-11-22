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

async function fixFormatResultMerge() {
  console.log('📥 Получаю текущий workflow...\n');
  
  const workflowData = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  const workflow = workflowData.data || workflowData;
  
  if (!workflow || !workflow.nodes) {
    throw new Error('Неверная структура ответа от API');
  }
  
  console.log(`✅ Workflow получен: ${workflow.name}\n`);
  
  // Добавляем ноду "Merge Results" для объединения результатов от Save Prices и Save Cars
  console.log('🔧 Добавляю ноду "Merge Results"...');
  const mergeResultsNode = {
    parameters: {
      numberInputs: 2
    },
    name: 'Merge Results',
    type: 'n8n-nodes-base.merge',
    typeVersion: 3,
    position: [3232, 304],
    id: 'merge-results-daily'
  };
  
  workflow.nodes.push(mergeResultsNode);
  console.log('✅ Нода "Merge Results" добавлена\n');
  
  // Обновляем ноду "Format Result" - она должна обрабатывать данные от Merge Results
  console.log('🔧 Обновляю ноду "Format Result"...');
  const formatResultNode = workflow.nodes.find(n => n.id === 'c0416477-3278-4b24-9bc5-b7d280ed6705');
  if (!formatResultNode) {
    throw new Error('Нода "Format Result" не найдена');
  }
  
  const currentCode = formatResultNode.parameters.jsCode;
  
  // Обновляем код для обработки данных от Save Prices и Save Cars
  const updatedCode = `const stats = $getWorkflowStaticData('global').carStats || {};
const priceStats = $getWorkflowStaticData('global').priceStats || {};
const total = stats.cars || 0;
const totalPrices = priceStats.prices || 0;
const branchSummary = Object.entries(stats.branches || {}).map(([branch, data]) => \`\${branch}: \${data.cars || 0}\`).join(', ');

let message = '';
if (total > 0 || totalPrices > 0) {
  message = \`🚗 Синхронизация автомобилей RentProg раз в сутки\\n\\n\`;
  message += \`📊 Автомобили: \${total}\\n\`;
  message += \`Филиалы: \${branchSummary || 'нет данных'}\\n\`;
  if (totalPrices > 0) {
    message += \`\\n💰 Цены: \${totalPrices} сохранено\`;
  }
} else {
  message = 'ℹ️ Синхронизация автомобилей RentProg раз в сутки\\nНовых данных не обнаружено';
}

return [{ json: { message, stats, priceStats, total_cars: total, total_prices: totalPrices, error: false } }];`;
  
  formatResultNode.parameters.jsCode = updatedCode;
  console.log('✅ Нода "Format Result" обновлена\n');
  
  // Обновляем connections
  console.log('🔧 Обновляю connections...');
  
  // Save Prices → Merge Results (input 0)
  workflow.connections['Save Prices'] = {
    main: [[
      { node: 'Merge Results', type: 'main', index: 0 }
    ]]
  };
  
  // Save Cars → Merge Results (input 1)
  workflow.connections['Save Cars'] = {
    main: [[
      { node: 'Merge Results', type: 'main', index: 1 }
    ]]
  };
  
  // Merge Results → Format Result
  workflow.connections['Merge Results'] = {
    main: [[
      { node: 'Format Result', type: 'main', index: 0 }
    ]]
  };
  
  // Has Data? True branch (нет данных) → Format Result (оставляем как есть)
  // Но нужно проверить, что Format Result может обработать пустые данные
  
  console.log('✅ Connections обновлены\n');
  
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
  console.log('  ✅ Добавлена нода "Merge Results" для объединения результатов');
  console.log('  ✅ Обновлена нода "Format Result" для обработки данных от Save Prices и Save Cars');
  console.log('  ✅ Save Prices → Merge Results → Format Result');
  console.log('  ✅ Save Cars → Merge Results → Format Result');
  console.log('\n✅ Готово!');
}

fixFormatResultMerge()
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

