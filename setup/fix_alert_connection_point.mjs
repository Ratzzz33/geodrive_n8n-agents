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

async function fixAlertConnection(workflowId, branch) {
  console.log(`\n📝 Исправление ${branch}...`);
  
  try {
    const workflow = await getWorkflow(workflowId);
    console.log(`   ✓ Workflow получен`);
    
    // Найти ключевые ноды
    const parseNode = workflow.nodes.find(n => n.id === 'parse-webhook' || n.name.includes('Parse'));
    const formatNode = workflow.nodes.find(n => n.name === 'Format Telegram Alert');
    const insertNode = workflow.nodes.find(n => n.id === 'insert-fetched');
    
    if (!parseNode || !formatNode) {
      console.log(`   ⚠️ Parse или Format node не найдены`);
      return;
    }
    
    console.log(`   ✓ Parse node: ${parseNode.name}`);
    console.log(`   ✓ Format node: ${formatNode.name}`);
    
    // Отключить старый connection (от insert-fetched к format)
    if (workflow.connections[insertNode?.name]) {
      const connections = workflow.connections[insertNode.name].main[0];
      const filteredConnections = connections.filter(c => c.node !== formatNode.name);
      workflow.connections[insertNode.name].main[0] = filteredConnections;
      console.log(`   ✓ Удалён старый connection от ${insertNode.name}`);
    }
    
    // Создать новый connection (от parse-webhook к format)
    if (!workflow.connections[parseNode.name]) {
      workflow.connections[parseNode.name] = { main: [[]] };
    }
    
    // Проверить, есть ли уже connection к format
    const hasFormatConnection = workflow.connections[parseNode.name].main[0].some(
      c => c.node === formatNode.name
    );
    
    if (!hasFormatConnection) {
      workflow.connections[parseNode.name].main[0].push({
        node: formatNode.name,
        type: 'main',
        index: 0
      });
      console.log(`   ✓ Добавлен connection: ${parseNode.name} → ${formatNode.name}`);
    } else {
      console.log(`   ℹ️ Connection уже существует`);
    }
    
    // Сохранить
    await updateWorkflow(workflowId, workflow);
    console.log(`   ✅ ${branch} обновлён!`);
    
  } catch (error) {
    console.error(`   ❌ Ошибка для ${branch}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Исправление точки подключения Telegram Alert\n');
  console.log('Подключаем Format Alert к Parse Webhook (ДО Prepare Update)...\n');
  console.log('='.repeat(60));
  
  for (const wf of WORKFLOWS) {
    await fixAlertConnection(wf.id, wf.branch);
  }
  
  console.log('\n✅ Готово!');
  console.log('\nТеперь Format Telegram Alert получает оригинальный payload с [old, new]');
  console.log('\n📝 Проверьте workflows:');
  for (const wf of WORKFLOWS) {
    console.log(`   - ${wf.branch}: https://n8n.rentflow.rentals/workflow/${wf.id}`);
  }
}

main().catch(console.error);

