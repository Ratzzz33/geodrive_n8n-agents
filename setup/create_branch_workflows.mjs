import { readFileSync } from 'fs';

// Параметры для каждого филиала
const branches = [
  {
    name: 'Tbilisi Processor Rentprog',
    webhookPath: 'tbilisi-webhook',
    webhookId: 'tbilisi-webhook',
    companyId: 9110,
    companyToken: '91b83b93963633649f29a04b612bab3f9fbb0471b5928622',
    branch: 'tbilisi'
  },
  {
    name: 'Batumi Processor Rentprog',
    webhookPath: 'batumi-webhook',
    webhookId: 'batumi-webhook',
    companyId: 9247,
    companyToken: '7ad345720f8d92f10c187122427c6a2c2bb9494c6bf14e8d',
    branch: 'batumi'
  },
  {
    name: 'Kutaisi Processor Rentprog',
    webhookPath: 'kutaisi-webhook',
    webhookId: 'kutaisi-webhook',
    companyId: 9360,
    companyToken: '5599ebb7a1f0a1e5f6a5d4e3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b',
    branch: 'kutaisi'
  }
];

// Читаем базовый workflow
const baseWorkflow = JSON.parse(readFileSync('n8n-workflows/service-center-processor-rentprog.json', 'utf8'));

console.log(`📋 Создаю ${branches.length} workflow для филиалов...\n`);

for (const branchConfig of branches) {
  console.log(`\n🔧 Создаю workflow: ${branchConfig.name}`);
  
  // Клонируем базовый workflow
  const workflow = JSON.parse(JSON.stringify(baseWorkflow));
  
  // Обновляем название
  workflow.name = branchConfig.name;
  
  // Обновляем webhook node
  const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  if (webhookNode) {
    webhookNode.parameters.path = branchConfig.webhookPath;
    webhookNode.webhookId = branchConfig.webhookId;
    webhookNode.name = `Webhook (${branchConfig.name.split(' ')[0]})`;
  }
  
  // Обновляем Parse Webhook node (company_id, branch, event_hash)
  const parseNode = workflow.nodes.find(n => n.name === 'Parse Webhook');
  if (parseNode) {
    const code = parseNode.parameters.jsCode;
    parseNode.parameters.jsCode = code
      .replace(/company_id: 11163/g, `company_id: ${branchConfig.companyId}`)
      .replace(/branch: 'service-center'/g, `branch: '${branchConfig.branch}'`)
      .replace(/service-center_/g, `${branchConfig.branch}_`);
  }
  
  // Обновляем Prepare Create node (company_id)
  const prepareCreateNode = workflow.nodes.find(n => n.name === 'Prepare Create');
  if (prepareCreateNode) {
    prepareCreateNode.parameters.jsCode = prepareCreateNode.parameters.jsCode
      .replace(/company_id: 11163/g, `company_id: ${branchConfig.companyId}`);
  }
  
  // Обновляем Get RentProg Token node (company_token)
  const tokenNode = workflow.nodes.find(n => n.name === 'Get RentProg Token');
  if (tokenNode) {
    tokenNode.parameters.jsCode = tokenNode.parameters.jsCode
      .replace(/const companyToken = '[^']+';/g, `const companyToken = '${branchConfig.companyToken}';`)
      .replace(/\/\/ service-center/g, `// ${branchConfig.branch}`);
  }
  
  // Удаляем системные поля
  delete workflow.id;
  delete workflow.versionId;
  delete workflow.updatedAt;
  delete workflow.createdAt;
  
  // Сохраняем в файл для проверки
  const filename = `n8n-workflows/${branchConfig.branch}-processor-rentprog.json`;
  require('fs').writeFileSync(filename, JSON.stringify(workflow, null, 2), 'utf8');
  
  console.log(`  ✅ Workflow подготовлен: ${filename}`);
  console.log(`  📝 Webhook: ${branchConfig.webhookPath}`);
  console.log(`  🏢 Company ID: ${branchConfig.companyId}`);
}

console.log(`\n✅ Все ${branches.length} workflow подготовлены!`);
console.log(`\n📌 Теперь импортируйте их через n8n UI или используйте MCP API для создания.`);
