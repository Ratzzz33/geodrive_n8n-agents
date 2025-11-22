#!/usr/bin/env node
/**
 * Обновление workflow Tbilisi: исправление ноды Prepare Update для фильтрации NULL
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_BASE_URL = 'https://n8n.rentflow.rentals/api/v1';
const WORKFLOW_ID = 'P65bXE5Xhupkxxw6';

async function updateWorkflow() {
  console.log('📥 Получаю текущий workflow...');
  
  const response = await fetch(`${N8N_BASE_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status} ${response.statusText}`);
  }
  
  const workflow = await response.json();
  
  console.log('🔧 Обновляю ноду "Prepare Update"...');
  
  // Находим ноду "Prepare Update"
  const prepareUpdateNode = workflow.nodes.find(n => n.id === 'prepare-update');
  
  if (!prepareUpdateNode) {
    throw new Error('Нода "Prepare Update" не найдена');
  }
  
  // Обновляем код ноды - добавляем фильтрацию NULL
  prepareUpdateNode.parameters.jsCode = `// Извлекаем последние значения из массивов [old, new]
// ИСПРАВЛЕНИЕ: Фильтруем NULL и undefined значения, чтобы не затереть существующие данные
const payload = $('Pass Data').first().json.payload;
const updates = {};

for (const [key, value] of Object.entries(payload)) {
  if (Array.isArray(value) && value.length === 2) {
    // Берём последнее значение, но пропускаем NULL и undefined
    const newValue = value[1];
    if (newValue !== null && newValue !== undefined && newValue !== '') {
      updates[key] = newValue;
    }
  } else if (key !== 'id' && value !== null && value !== undefined && value !== '') {
    updates[key] = value;
  }
}

const entityId = $json.entity_id;

return {
  json: {
    entity_id: entityId,
    updates: updates,
    updates_json: JSON.stringify(updates)
  }
};`;
  
  console.log('💾 Сохраняю обновленный workflow...');
  
  const updateResponse = await fetch(`${N8N_BASE_URL}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    })
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.status} ${errorText}`);
  }
  
  console.log('✅ Workflow обновлен успешно!');
}

updateWorkflow()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  });

