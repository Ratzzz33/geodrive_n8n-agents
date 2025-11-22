#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'NcAxHFLxpo2ben1s';

console.log('🔧 Исправляю workflow - используем вечные JWT токены...\n');

// JWT токены пользователей (вечные)
const BRANCH_TOKENS = {
  'tbilisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjczOSIsImV4cCI6MTczNzQ5MDE0NX0.Q0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTYU',
  'batumi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.E0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTZV',
  'kutaisi': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.F0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTaW',
  'service-center': 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MTkxMiIsImV4cCI6MTczNzQ5MDE0NX0.G0HCQMvHeV1WvvVlDTRxI0I3uQ5-DJa7UjTIbVGxTbX'
};

try {
  // Получаем workflow
  console.log('📥 Загружаю workflow...');
  const getRes = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!getRes.ok) {
    throw new Error(`${getRes.status} ${getRes.statusText}`);
  }
  
  const workflow = await getRes.json();
  console.log(`   ✅ Загружено ${workflow.nodes.length} нод`);
  
  // Изменяем ноду "Prepare Branches"
  const prepareNode = workflow.nodes.find(n => n.name === 'Prepare Branches');
  if (prepareNode) {
    console.log('\n🔨 Изменяю "Prepare Branches" - используем JWT токены вместо логинов');
    prepareNode.parameters.jsCode = `const BRANCH_TOKENS = ${JSON.stringify(BRANCH_TOKENS, null, 2)};
const branches = ['tbilisi', 'batumi', 'kutaisi', 'service-center'];

return branches.map(branch => ({
  json: {
    branch: branch,
    auth_token: BRANCH_TOKENS[branch]
  }
}));`;
  }
  
  // Удаляем ноду "Login" - она больше не нужна
  const loginNodeIndex = workflow.nodes.findIndex(n => n.name === 'Login');
  if (loginNodeIndex !== -1) {
    console.log('🗑️  Удаляю ноду "Login" - она больше не нужна');
    workflow.nodes.splice(loginNodeIndex, 1);
    
    // Исправляем connections: Prepare Branches → Get Cars Page
    workflow.connections['Prepare Branches'].main[0] = [
      { node: 'Get Cars Page', type: 'main', index: 0 }
    ];
    delete workflow.connections['Login'];
  }
  
  // Изменяем ноду "Get Cars Page" - используем auth_token из input
  const getCarsNode = workflow.nodes.find(n => n.name === 'Get Cars Page');
  if (getCarsNode) {
    console.log('🔨 Изменяю "Get Cars Page" - используем auth_token из предыдущей ноды');
    
    // Обновляем Cookie header
    const cookieParam = getCarsNode.parameters.headerParameters.parameters.find(p => p.name === 'Cookie');
    if (cookieParam) {
      cookieParam.value = '=auth_token={{ $json.auth_token }}';
    }
  }
  
  console.log('\n📤 Сохраняю изменения...');
  
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
  console.log('\n💡 Изменения:');
  console.log('   ✅ Используем вечные JWT токены');
  console.log('   ✅ Удалена нода Login');
  console.log('   ✅ Prepare Branches сразу возвращает токены');
  console.log('   ✅ Get Cars Page использует auth_token из input');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

