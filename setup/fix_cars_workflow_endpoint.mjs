#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'UPa1iLM6h958MjQj';

console.log('🔧 Исправляю endpoint в workflow для парсинга автомобилей...');
console.log(`   Меняю: /api/v1/search_cars → /api/v1/public/cars`);

try {
  // Получаем текущий workflow
  const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  if (!getResponse.ok) {
    throw new Error(`GET failed: ${getResponse.status} ${getResponse.statusText}`);
  }

  const result = await getResponse.json();
  const workflow = result.data;
  
  // Обновляем HTTP Request ноды
  let fixedCount = 0;
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const oldUrl = node.parameters.url;
      if (oldUrl && oldUrl.includes('/search_cars')) {
        node.parameters.url = 'https://rentprog.net/api/v1/public/cars';
        node.parameters.method = 'GET';
        // Убираем body для GET запроса
        delete node.parameters.sendBody;
        delete node.parameters.specifyBody;
        delete node.parameters.jsonBody;
        // Добавляем query параметры
        node.parameters.sendQuery = true;
        node.parameters.queryParameters = {
          parameters: [
            { name: 'per_page', value: '100' },
            { name: 'page', value: '={{ $json.page }}' }
          ]
        };
        console.log(`   ✅ Исправлена нода: ${node.name}`);
        fixedCount++;
      }
    }
  });

  if (fixedCount === 0) {
    console.log('   ℹ️  Ничего не исправлено - ноды уже корректны или не найдены');
    process.exit(0);
  }

  console.log(`\n   Исправлено нод: ${fixedCount}`);
  console.log('   📤 Обновляю workflow...');

  // Обновляем workflow
  const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`UPDATE failed: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
  }

  console.log('\n✅ Workflow успешно обновлен!');
  console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\n💡 Теперь можно запустить workflow через UI для тестирования');

} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

