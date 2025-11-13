#!/usr/bin/env node
/**
 * Добавление Merge ноды для сбора данных со всех 8 параллельных потоков
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function updateWorkflow() {
  console.log(`\n🔧 Добавление Merge ноды...`);
  
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
  
  // Добавляем Merge ноду
  const mergeNode = {
    "parameters": {
      "mode": "combine",
      "combinationMode": "multiplex",
      "options": {}
    },
    "name": "Merge All Branches",
    "type": "n8n-nodes-base.merge",
    "typeVersion": 3,
    "position": [720, 550]
  };
  
  current.nodes.push(mergeNode);
  console.log('✅ Добавлена нода "Merge All Branches"');
  
  // Обновляем connections: все 8 HTTP нод → Merge
  const httpNodes = [
    'Get Tbilisi Active',
    'Get Tbilisi Inactive',
    'Get Batumi Active',
    'Get Batumi Inactive',
    'Get Kutaisi Active',
    'Get Kutaisi Inactive',
    'Get Service Active',
    'Get Service Inactive'
  ];
  
  // Подключаем все HTTP ноды к Merge (input1)
  httpNodes.forEach((nodeName, index) => {
    current.connections[nodeName] = {
      "main": [[{
        "node": "Merge All Branches",
        "type": "main",
        "index": 0  // Все в input1
      }]]
    };
  });
  
  // Merge → Process All Bookings
  current.connections['Merge All Branches'] = {
    "main": [[{
      "node": "Process All Bookings",
      "type": "main",
      "index": 0
    }]]
  };
  
  console.log('✅ Обновлены connections (8 HTTP → Merge → Process)');
  
  // Обновляем позицию Process All Bookings
  const processNode = current.nodes.find(n => n.name === 'Process All Bookings');
  if (processNode) {
    processNode.position = [920, 550];
  }
  
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
  console.log(`\n📝 Новая структура:`);
  console.log(`  Schedule Trigger`);
  console.log(`    ↓ (8 параллельных потоков)`);
  console.log(`  Get Tbilisi Active/Inactive`);
  console.log(`  Get Batumi Active/Inactive`);
  console.log(`  Get Kutaisi Active/Inactive`);
  console.log(`  Get Service Active/Inactive`);
  console.log(`    ↓ (все 8 → Merge)`);
  console.log(`  Merge All Branches ← ДОЖИДАЕТСЯ ВСЕХ 8!`);
  console.log(`    ↓`);
  console.log(`  Process All Bookings`);
  console.log(`    ↓`);
  console.log(`  Save to DB`);
  console.log(`    ↓`);
  console.log(`  ...`);
  console.log(`\n🎯 Теперь Process получит ВСЕ данные!`);
}

updateWorkflow().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});

