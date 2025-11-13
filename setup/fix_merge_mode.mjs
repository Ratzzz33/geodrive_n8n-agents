#!/usr/bin/env node
/**
 * Исправление режима Merge ноды на "append" (простое объединение всех items)
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n🔧 Исправление Merge ноды...`);
  
  // Получаем текущий workflow
  const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
  }
  
  const current = await getResponse.json();
  console.log(`✅ Получен workflow: ${current.name}`);
  
  // Находим Merge ноду
  const mergeNode = current.nodes.find(n => n.name === 'Merge All Branches');
  
  if (!mergeNode) {
    throw new Error('Node "Merge All Branches" not found');
  }
  
  console.log('✅ Найдена нода "Merge All Branches"');
  console.log(`   Текущий режим: ${mergeNode.parameters.mode}`);
  
  // Меняем на режим "append" - просто собирает все items
  mergeNode.parameters = {
    "mode": "append"
  };
  
  console.log('✅ Режим изменен на "append"');
  console.log('   → Просто объединит все items из 8 входов');
  
  // Удаляем id из нод
  current.nodes.forEach(node => {
    delete node.id;
  });
  
  // Создаем чистый объект для обновления
  const updateData = {
    name: current.name,
    nodes: current.nodes,
    connections: current.connections,
    settings: current.settings
  };
  
  // Обновляем workflow
  const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
  }
  
  const result = await updateResponse.json();
  console.log(`\n✅ Workflow обновлен успешно!`);
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log(`\n📝 Режим "append":`);
  console.log(`  - Дожидается ВСЕХ 8 входов`);
  console.log(`  - Объединяет все items в один массив`);
  console.log(`  - НЕ требует настройки полей`);
  console.log(`  - Сохраняет порядок (0-7)`);
  console.log(`\n🎯 Теперь ошибка исчезнет!`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

