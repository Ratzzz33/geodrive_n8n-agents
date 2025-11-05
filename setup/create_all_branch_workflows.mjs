#!/usr/bin/env node
/**
 * Создание workflow для всех филиалов: Tbilisi, Batumi, Kutaisi
 */

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const BASE_WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

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

async function getBaseWorkflow() {
  console.log('📥 Получение базового workflow...');
  const response = await fetch(`${N8N_HOST}/workflows/${BASE_WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Ошибка получения workflow: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const workflow = data.data || data;

  if (!workflow || !workflow.nodes) {
    throw new Error('Не удалось получить базовый workflow');
  }

  // Убираем системные поля
  delete workflow.id;
  delete workflow.versionId;
  delete workflow.updatedAt;
  delete workflow.createdAt;
  delete workflow.shared;
  delete workflow.tags;
  delete workflow.triggerCount;
  delete workflow.pinData;
  delete workflow.active;
  delete workflow.isArchived;
  delete workflow.staticData;
  delete workflow.meta;

  console.log(`   ✓ Базовый workflow получен (${workflow.nodes.length} nodes)\n`);
  return workflow;
}

function modifyWorkflowForBranch(baseWorkflow, branch) {
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
    code = code.replace(/service-center_\$\{eventName\}_\$\{rentprogId\}/g, `${branch.code}_\${eventName}_\${rentprogId}`);
    code = code.replace(/service-center_/g, `${branch.code}_`);
    parseNode.parameters.jsCode = code;
  }

  // Обновляем Prepare Create node
  const prepareCreateNode = workflow.nodes.find(n => n.id === 'prepare-create');
  if (prepareCreateNode) {
    let code = prepareCreateNode.parameters.jsCode;
    code = code.replace(/company_id: 11163/g, `company_id: ${branch.company_id}`);
    prepareCreateNode.parameters.jsCode = code;
  }

  // Обновляем Get RentProg Token node
  const tokenNode = workflow.nodes.find(n => n.id === 'get-token');
  if (tokenNode) {
    let code = tokenNode.parameters.jsCode;
    // Заменяем токен service-center на токен филиала
    code = code.replace(/const companyToken = '[^']+';/g, `const companyToken = '${branch.company_token}';`);
    code = code.replace(/\/\/ service-center/g, `// ${branch.code}`);
    tokenNode.parameters.jsCode = code;
  }

  // Обновляем connections (имя webhook node изменилось)
  const oldKey = 'Webhook (Service Center)';
  const newKey = `Webhook (${branch.name})`;
  if (workflow.connections[oldKey]) {
    workflow.connections[newKey] = workflow.connections[oldKey];
    delete workflow.connections[oldKey];
  }

  return workflow;
}

async function createWorkflow(workflow) {
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
    throw new Error(`${response.status} ${response.statusText}: ${error.substring(0, 300)}`);
  }

  const result = await response.json();
  // n8n API может возвращать данные напрямую или в data.data
  return result.data || result;
}

async function main() {
  console.log('🚀 Создание workflow для всех филиалов...\n');

  // Получаем базовый workflow один раз
  const baseWorkflow = await getBaseWorkflow();

  const results = [];

  for (const branch of branches) {
    console.log(`\n🔧 Создание workflow: ${branch.name}`);
    console.log(`   Webhook: ${branch.webhook_path}`);
    console.log(`   Company ID: ${branch.company_id}`);

    try {
      // Модифицируем workflow для филиала
      const workflow = modifyWorkflowForBranch(baseWorkflow, branch);

      // Создаём workflow
      const result = await createWorkflow(workflow);
      
      const workflowId = result.id || (result.data && result.data.id);
      if (!workflowId) {
        console.log('   ⚠️ Полный ответ:', JSON.stringify(result).substring(0, 500));
        throw new Error('Не удалось получить workflow ID из ответа');
      }
      
      console.log(`   ✅ Создан: ${workflowId}`);
      console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);

      results.push({ branch: branch.name, id: workflowId, success: true });
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}`);
      results.push({ branch: branch.name, error: error.message, success: false });
    }
  }

  console.log('\n\n📊 Результаты:');
  console.log('─'.repeat(50));
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.branch}: ${r.id}`);
    } else {
      console.log(`❌ ${r.branch}: ${r.error}`);
    }
  });
  console.log('─'.repeat(50));

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Успешно создано: ${successCount}/${branches.length}\n`);
}

main().catch(err => {
  console.error('\n❌ Критическая ошибка:', err.message);
  process.exit(1);
});

