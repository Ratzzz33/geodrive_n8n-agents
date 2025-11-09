import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = '1LOkRW4ROSx92SQO';

const API_URL = `${N8N_HOST}/workflows/${WORKFLOW_ID}`;

const options = {
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
  }
};

console.log('🔍 Получаем текущий workflow...');

const req = https.request(API_URL, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('❌ Ошибка:', data);
      process.exit(1);
    }

    const response = JSON.parse(data);
    const workflow = response.data;

    console.log('✅ Workflow получен');

    // Находим ноду "Process & Format Data"
    const processNode = workflow.nodes.find(n => n.id === 'process-data');
    
    if (!processNode) {
      console.error('❌ Нода "Process & Format Data" не найдена!');
      process.exit(1);
    }

    // Обновляем код с безопасным доступом
    processNode.parameters.jsCode = `const branch = $('Prepare Branches').item.json.branch;

// Безопасное получение данных со всех входов
const inputs = $input.all();
let companyCash = null;
let bookings = null;

// Проходим по всем входным данным
inputs.forEach(input => {
  const json = input.json;
  
  // Определяем, откуда пришли данные
  if (json && json.data && Array.isArray(json.data)) {
    // Это данные о bookings
    bookings = json;
  } else if (json && (json.error || json.counts || json.cash_gel !== undefined)) {
    // Это данные о кассе компании
    companyCash = json;
  }
});

// Обработка кассы компании
let cashData = null;
if (companyCash && !companyCash.error) {
  cashData = {
    type: 'company_cash',
    branch,
    data: companyCash,
    timestamp: new Date().toISOString()
  };
}

// Обработка событий (bookings)
let eventsData = [];
if (bookings && Array.isArray(bookings.data)) {
  eventsData = bookings.data.map(booking => ({
    type: 'booking_event',
    branch,
    booking_id: booking.id,
    event_type: booking.state,
    data: booking,
    timestamp: new Date().toISOString()
  }));
}

const result = [];
if (cashData) result.push({ json: cashData });
result.push(...eventsData.map(e => ({ json: e })));

return result.length > 0 ? result : [{ json: { branch, status: 'no_data' } }];`;

    // Удаляем лишние поля
    delete workflow.id;
    delete workflow.versionId;
    delete workflow.updatedAt;
    delete workflow.createdAt;
    delete workflow.shared;
    delete workflow.tags;

    // Сохраняем
    const updateData = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    });

    const updateOptions = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateData)
      }
    };

    console.log('💾 Сохраняем исправленный workflow...');

    const updateReq = https.request(API_URL, updateOptions, (updateRes) => {
      let updateData = '';

      updateRes.on('data', (chunk) => {
        updateData += chunk;
      });

      updateRes.on('end', () => {
        if (updateRes.statusCode !== 200) {
          console.error('❌ Ошибка при обновлении:', updateData);
          process.exit(1);
        }

        console.log('✅ Workflow успешно обновлён!');
        console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
      });
    });

    updateReq.on('error', (error) => {
      console.error('❌ Ошибка сети:', error.message);
      process.exit(1);
    });

    updateReq.write(updateData);
    updateReq.end();
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка сети:', error.message);
  process.exit(1);
});

req.end();

