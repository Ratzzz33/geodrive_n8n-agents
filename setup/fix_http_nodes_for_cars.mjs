#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'u3cOUuoaH5RSw7hm';

console.log('🔧 Исправляю только 4 HTTP Request ноды...\n');

try {
  const getRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!getRes.ok) throw new Error(`${getRes.status} ${getRes.statusText}`);
  
  const workflow = await getRes.json();
  console.log(`📥 Загружено ${workflow.nodes.length} нод`);
  
  // Находим HTTP Request ноды
  const httpNodes = workflow.nodes.filter(n => 
    n.type === 'n8n-nodes-base.httpRequest' && 
    (n.name.includes('Get '))
  );
  
  console.log(`\n🔨 Найдено ${httpNodes.length} HTTP Request нод для изменения:\n`);
  
  for (const node of httpNodes) {
    console.log(`   📍 ${node.name}`);
    console.log(`      Старый URL: ${node.parameters.url}`);
    console.log(`      Старый Method: ${node.parameters.method || 'GET'}`);
    
    // Меняем на GET запрос к HTML странице
    node.parameters.method = 'GET';
    node.parameters.url = 'https://web.rentprog.ru/cars';
    
    // Убираем body
    delete node.parameters.sendBody;
    delete node.parameters.bodyParameters;
    delete node.parameters.jsonBody;
    delete node.parameters.contentType;
    
    // Меняем headers
    node.parameters.headerParameters = {
      parameters: [
        { name: 'Cookie', value: '=auth_token={{ $json.token }}' },
        { name: 'Accept', value: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      ]
    };
    
    // Меняем response format на text
    if (!node.parameters.options) {
      node.parameters.options = {};
    }
    node.parameters.options.response = {
      response: {
        fullResponse: false,
        responseFormat: 'text'
      }
    };
    
    console.log(`      ✅ Новый URL: https://web.rentprog.ru/cars`);
    console.log(`      ✅ Новый Method: GET`);
    console.log(`      ✅ Headers: Cookie (auth_token)`);
    console.log(`      ✅ Response: text/html\n`);
  }
  
  console.log('📤 Сохраняю изменения...');
  
  const updateRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });
  
  if (!updateRes.ok) {
    const error = await updateRes.text();
    throw new Error(`${updateRes.status}\n${error}`);
  }
  
  console.log('\n✅ ГОТОВО!');
  console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\n💡 Изменено:');
  console.log(`   • ${httpNodes.length} HTTP нод обновлены`);
  console.log('   • POST → GET');
  console.log('   • API endpoint → HTML страница');
  console.log('   • Authorization Bearer → Cookie auth_token');
  console.log('   • Response: JSON → text/html');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

