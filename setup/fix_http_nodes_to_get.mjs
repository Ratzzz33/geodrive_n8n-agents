#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'EV1kz456g6f9tc5P';

console.log('🔧 Исправляю HTTP Request ноды в workflow...');
console.log(`   Workflow: ${WORKFLOW_ID}`);

try {
  // Получаем workflow
  const getRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  if (!getRes.ok) {
    throw new Error(`GET failed: ${getRes.status} ${getRes.statusText}`);
  }

  const workflow = await getRes.json();

  if (!workflow || !workflow.nodes) {
    console.log('DEBUG: Response structure:', JSON.stringify(workflow).substring(0, 500));
    throw new Error('Invalid workflow structure');
  }

  console.log(`\n📋 Найдено ${workflow.nodes.length} нод`);

  // Исправляем HTTP Request ноды
  let fixed = 0;
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.httpRequest' && 
        node.parameters.url && 
        node.parameters.url.includes('cars')) {
      
      console.log(`\n   🔨 Исправляю ноду: ${node.name}`);
      console.log(`      Старый метод: ${node.parameters.method}`);
      console.log(`      Старый URL: ${node.parameters.url}`);

      // Обновляем параметры
      node.parameters.method = 'GET';
      node.parameters.url = 'https://rentprog.net/api/v1/public/cars';
      
      // Убираем body параметры
      delete node.parameters.sendBody;
      delete node.parameters.specifyBody;
      delete node.parameters.jsonBody;
      delete node.parameters.contentType;
      
      // Добавляем query параметры
      node.parameters.sendQuery = true;
      node.parameters.queryParameters = {
        parameters: [
          { name: 'per_page', value: '100' },
          { name: 'page', value: '={{ $json.page }}' }
        ]
      };

      // Убираем Content-Type из headers (не нужен для GET)
      if (node.parameters.headerParameters && node.parameters.headerParameters.parameters) {
        node.parameters.headerParameters.parameters = 
          node.parameters.headerParameters.parameters.filter(h => h.name !== 'Content-Type');
      }

      console.log(`      ✅ Новый метод: GET`);
      console.log(`      ✅ Новый URL: https://rentprog.net/api/v1/public/cars`);
      console.log(`      ✅ Query: per_page=100, page={{ $json.page }}`);
      
      fixed++;
    }
  });

  if (fixed === 0) {
    console.log('\n   ⚠️  HTTP Request ноды не найдены или уже исправлены');
    process.exit(0);
  }

  console.log(`\n   Исправлено нод: ${fixed}`);
  console.log('\n📤 Сохраняю изменения...');

  // Сохраняем workflow
  const updateRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });

  if (!updateRes.ok) {
    const errorText = await updateRes.text();
    throw new Error(`Update failed: ${updateRes.status}\n${errorText}`);
  }

  console.log('\n✅ Workflow успешно обновлен!');
  console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\n💡 Теперь можно запустить "Test workflow" для проверки');

} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

