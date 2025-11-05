#!/usr/bin/env node
/**
 * Создание 3 workflow для филиалов на основе Service Center
 */

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const branches = [
  {
    name: 'Tbilisi',
    code: 'tbilisi',
    company_id: 9110,
    company_token: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
    webhook_path: 'tbilisi-webhook'
  },
  {
    name: 'Batumi',
    code: 'batumi',
    company_id: 9247,
    company_token: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
    webhook_path: 'batumi-webhook'
  },
  {
    name: 'Kutaisi',
    code: 'kutaisi',
    company_id: 9360,
    company_token: '5599ebb7b94827fdfd49ca3a5b7e259cfa99d8ea78edeb50',
    webhook_path: 'kutaisi-webhook'
  }
];

async function createWorkflows() {
  console.log('\n🚀 Создание 3 workflow для филиалов...\n');

  // 1. Получаем базовый workflow
  console.log('1️⃣ Получение Service Center workflow...');
  const baseResponse = await fetch(`${N8N_HOST}/workflows/PbDKuU06H7s2Oem8`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const baseData = await baseResponse.json();
  const baseWorkflow = baseData.data;

  // Убираем системные поля
  if (!baseWorkflow) {
    console.error('❌ Не удалось получить baseWorkflow');
    return;
  }
  
  delete baseWorkflow.id;
  delete baseWorkflow.versionId;
  delete baseWorkflow.updatedAt;
  delete baseWorkflow.createdAt;
  delete baseWorkflow.shared;
  delete baseWorkflow.tags;
  delete baseWorkflow.triggerCount;
  delete baseWorkflow.pinData;

  console.log('   ✓ Базовый workflow получен (' + baseWorkflow.nodes.length + ' nodes)\n');

  // 2. Создаём workflow для каждого филиала
  for (const branch of branches) {
    console.log(`2️⃣ Создание workflow для ${branch.name}...`);

    // Клонируем базовый workflow
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
      // Заменяем company_id, branch, eventHash prefix
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

    // Обновляем connections для webhook
    const oldKey = 'Webhook (Service Center)';
    const newKey = `Webhook (${branch.name})`;
    if (workflow.connections[oldKey]) {
      workflow.connections[newKey] = workflow.connections[oldKey];
      delete workflow.connections[oldKey];
    }

    // 3. Отправляем запрос на создание
    try {
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
        console.log(`   Детали: ${error}`);
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Создан: ${result.data.id}`);
      console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${result.data.id}\n`);
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}\n`);
    }

    // Пауза между запросами
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('✅ Готово!\n');
}

createWorkflows().catch(console.error);

