#!/usr/bin/env node
/**
 * Создание Batumi workflow на основе Service Center
 */

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const branch = {
  name: 'Batumi',
  code: 'batumi',
  company_id: 9247,
  company_token: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
  webhook_path: 'batumi-webhook'
};

async function createBatumiWorkflow() {
  console.log('\n🚀 Создание Batumi workflow...\n');

  // 1. Получаем базовый workflow
  console.log('1️⃣ Получение Service Center workflow...');
  const baseResponse = await fetch(`${N8N_HOST}/workflows/PbDKuU06H7s2Oem8`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!baseResponse.ok) {
    console.error(`❌ Ошибка получения workflow: ${baseResponse.status} ${baseResponse.statusText}`);
    return;
  }
  
  const baseData = await baseResponse.json();
  const baseWorkflow = baseData.data || baseData;

  if (!baseWorkflow || !baseWorkflow.nodes) {
    console.error('❌ Не удалось получить baseWorkflow');
    console.log('Response:', JSON.stringify(baseData).substring(0, 200));
    return;
  }

  // Убираем системные поля
  delete baseWorkflow.id;
  delete baseWorkflow.versionId;
  delete baseWorkflow.updatedAt;
  delete baseWorkflow.createdAt;
  delete baseWorkflow.shared;
  delete baseWorkflow.tags;
  delete baseWorkflow.triggerCount;
  delete baseWorkflow.pinData;
  delete baseWorkflow.active;
  delete baseWorkflow.isArchived;
  delete baseWorkflow.staticData;
  delete baseWorkflow.meta;

  console.log(`   ✓ Базовый workflow получен (${baseWorkflow.nodes.length} nodes)`);

  // 2. Клонируем и модифицируем
  console.log(`\n2️⃣ Модификация для ${branch.name}...`);
  const workflow = JSON.parse(JSON.stringify(baseWorkflow));

  // Меняем имя
  workflow.name = `${branch.name} Processor Rentprog`;

  // Обновляем webhook node
  const webhookNode = workflow.nodes.find(n => n.id === 'webhook-node');
  if (webhookNode) {
    webhookNode.name = `Webhook (${branch.name})`;
    webhookNode.parameters.path = branch.webhook_path;
    webhookNode.webhookId = branch.webhook_path;
  }

  // Обновляем Parse Webhook node
  const parseNode = workflow.nodes.find(n => n.id === 'parse-webhook');
  if (parseNode) {
    let code = parseNode.parameters.jsCode;
    code = code.replace(/company_id: 11163/g, `company_id: ${branch.company_id}`);
    code = code.replace(/branch: 'service-center'/g, `branch: '${branch.code}'`);
    code = code.replace(/service-center_\$\{eventName\}/g, `${branch.code}_\${eventName}`);
    parseNode.parameters.jsCode = code;
  }

  // Обновляем Get RentProg Token node
  const tokenNode = workflow.nodes.find(n => n.id === 'get-token');
  if (tokenNode) {
    let code = tokenNode.parameters.jsCode;
    code = code.replace(/const companyToken = '5y4j4gcs75o9n5s1e2vrxx4a';/g, `const companyToken = '${branch.company_token}';`);
    tokenNode.parameters.jsCode = code;
  }

  // Обновляем Prepare Create node (company_id)
  const prepareCreateNode = workflow.nodes.find(n => n.id === 'prepare-create');
  if (prepareCreateNode) {
    let code = prepareCreateNode.parameters.jsCode;
    code = code.replace(/company_id: 11163/g, `company_id: ${branch.company_id}`);
    prepareCreateNode.parameters.jsCode = code;
  }

  // Обновляем connections
  const oldKey = 'Webhook (Service Center)';
  const newKey = `Webhook (${branch.name})`;
  if (workflow.connections[oldKey]) {
    workflow.connections[newKey] = workflow.connections[oldKey];
    delete workflow.connections[oldKey];
  }

  console.log('   ✓ Модификация завершена');

  // 3. Создаём workflow
  console.log(`\n3️⃣ Отправка в n8n...`);
  
  const response = await fetch(`${N8N_HOST}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(`   ❌ Ошибка: ${response.status} ${response.statusText}`);
    console.log(`   Детали: ${error.substring(0, 500)}`);
    return;
  }

  const result = await response.json();
  console.log(`   ✅ Создан: ${result.data.id}`);
  console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${result.data.id}`);
  console.log(`   📍 Webhook: https://n8n.rentflow.rentals/webhook/${branch.webhook_path}\n`);
  console.log('✅ Batumi workflow готов!\n');
}

createBatumiWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

