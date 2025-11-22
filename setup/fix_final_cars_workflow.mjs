import https from 'https';
import fs from 'fs';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';

async function getWorkflow(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://n8n.rentflow.rentals/api/v1/workflows/${id}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

console.log('🔍 Получаю текущий workflow...\n');

const response = await getWorkflow(WORKFLOW_ID);
const workflow = response.data;

console.log(`📋 Workflow: ${workflow.name}`);
console.log(`   Нод: ${workflow.nodes.length}`);
console.log('');

// Обновляем ноды
workflow.nodes.forEach(node => {
  // HTTP Request ноды
  if (node.type === 'n8n-nodes-base.httpRequest') {
    console.log(`🔧 Обновляю HTTP Request ноду: ${node.name}`);
    
    node.parameters = {
      method: 'POST',
      url: 'https://rentprog.net/api/v1/search_cars',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '=Bearer {{ $json.token }}' },
          { name: 'Accept', value: 'application/json' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={"page":{{ $json.page }},"per_page":100,"sort_by":"id","direction":"desc","search":null}',
      options: { timeout: 60000 }
    };
    
    node.retryOnFail = true;
    node.maxTries = 2;
    node.continueOnFail = true;
  }
  
  // Merge & Process нода - обновляем на обработку JSON
  if (node.name === 'Merge & Process') {
    console.log(`🔧 Обновляю Process ноду: ${node.name}`);
    
    node.parameters.jsCode = `const results = [];

for (const item of $input.all()) {
  const branch = item.json.branch;
  const responseData = item.json;
  
  // API возвращает массив cars или объект с data.cars
  let carsData = [];
  
  if (Array.isArray(responseData)) {
    carsData = responseData;
  } else if (responseData.data && Array.isArray(responseData.data)) {
    carsData = responseData.data;
  } else if (responseData.cars && Array.isArray(responseData.cars)) {
    carsData = responseData.cars;
  }
  
  if (carsData.length === 0) {
    results.push({
      json: {
        branch: branch,
        error: true,
        error_message: 'No cars data in response'
      }
    });
    continue;
  }
  
  // Обрабатываем каждый автомобиль
  for (const car of carsData) {
    results.push({
      json: {
        branch: branch,
        rentprog_id: car.id,
        car_name: car.name || car.car_name,
        code: car.code,
        number: car.number,
        color: car.color,
        year: car.year,
        price: car.price || 0,
        deposit: car.deposit || 0,
        data: car,
        error: false
      }
    });
  }
}

return results;`;
  }
});

// Обновляем workflow
console.log('\n📤 Сохраняю обновленный workflow...');

const body = JSON.stringify({
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings
});

const updateReq = https.request(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\n✅ Workflow обновлен!\n');
      console.log('🔗 URL: https://n8n.rentflow.rentals/workflow/u3cOUuoaH5RSw7hm');
      console.log('\n🚀 Теперь откройте workflow и нажмите "Test workflow"');
    } else {
      console.error('❌ Ошибка обновления:', data);
    }
  });
});

updateReq.on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message);
});

updateReq.write(body);
updateReq.end();

