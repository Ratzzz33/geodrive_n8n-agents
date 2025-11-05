#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const WORKFLOWS = [
  { id: 'YsBma7qYsdsDykTq', branch: 'BATUMI' },
  { id: 'gJPvJwGQSi8455s9', branch: 'KUTAISI' },
  { id: 'PbDKuU06H7s2Oem8', branch: 'SERVICE-CENTER' },
  { id: 'P65bXE5Xhupkxxw6', branch: 'TBILISI' }
];

async function getWorkflow(workflowId) {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || data;
}

async function updateWorkflow(workflowId, workflow) {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings || {}
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update workflow: ${response.status}\n${error}`);
  }
  
  return await response.json();
}

async function fixTelegramNode(workflowId, branch) {
  console.log(`\n📝 Исправление ${branch}...`);
  
  try {
    const workflow = await getWorkflow(workflowId);
    console.log(`   ✓ Workflow получен`);
    
    // Найти HTTP Request ноду для Telegram
    const httpNode = workflow.nodes.find(n => n.name === 'Send Telegram Alert' && n.type === 'n8n-nodes-base.httpRequest');
    
    if (!httpNode) {
      console.log(`   ⚠️ HTTP Request нода не найдена, пропускаю`);
      return;
    }
    
    console.log(`   ✓ Найдена HTTP Request нода`);
    
    // Заменить на стандартную Telegram ноду
    const telegramNode = {
      id: httpNode.id,
      name: httpNode.name,
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: httpNode.position,
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
        chatId: '={{ $env.TELEGRAM_ALERT_CHAT_ID }}',
        text: '={{ $json.message }}',
        additionalFields: {}
      },
      credentials: {
        telegramApi: {
          name: 'Telegram account'  // n8n найдет credential по имени
        }
      },
      continueOnFail: true
    };
    
    // Заменить ноду
    const nodeIndex = workflow.nodes.findIndex(n => n.id === httpNode.id);
    workflow.nodes[nodeIndex] = telegramNode;
    
    console.log(`   ✓ Нода заменена на Telegram node`);
    
    // Сохранить
    await updateWorkflow(workflowId, workflow);
    console.log(`   ✅ ${branch} обновлён!`);
    
  } catch (error) {
    console.error(`   ❌ Ошибка для ${branch}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Исправление Telegram нод во всех processor workflows\n');
  console.log('Заменяем HTTP Request на стандартную Telegram ноду...\n');
  console.log('='.repeat(60));
  
  for (const wf of WORKFLOWS) {
    await fixTelegramNode(wf.id, wf.branch);
  }
  
  console.log('\n✅ Готово!');
  console.log('\nТеперь используется credential "Telegram account"');
  console.log('\n📝 Проверьте workflows:');
  for (const wf of WORKFLOWS) {
    console.log(`   - ${wf.branch}: https://n8n.rentflow.rentals/workflow/${wf.id}`);
  }
}

main().catch(console.error);

