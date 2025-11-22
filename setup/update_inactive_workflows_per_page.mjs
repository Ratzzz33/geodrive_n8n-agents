#!/usr/bin/env node

/**
 * Обновление per_page в workflow неактивных броней:
 * 1. Парсинг броней RentProg (неактивные, Батуми) - FDMvu8P8DKilQTOK
 * 2. Парсинг броней RentProg (неактивные, Тбилиси) раз в час - 7gKTEFi1wyEaY8Ri
 * 3. Парсинг броней RentProg (неактивные, Кутаиси+Сервис) - DmgFVhxEeXl9AOjg
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOWS = [
  { id: 'FDMvu8P8DKilQTOK', name: '✅Парсинг броней RentProg (неактивные, Батуми)' },
  { id: '7gKTEFi1wyEaY8Ri', name: '✅Парсинг броней RentProg (неактивные, Тбилиси) раз в час' },
  { id: 'DmgFVhxEeXl9AOjg', name: '✅Парсинг броней RentProg (неактивные, Кутаиси+Сервис)' }
];

async function updateWorkflow(workflowId, workflowName) {
  console.log(`\n📥 Обновляю: ${workflowName}`);
  console.log(`   ID: ${workflowId}`);

  // 1. Получить workflow
  const getResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
  }

  const responseData = await getResponse.json();
  const workflow = responseData.data || responseData;

  // 2. Найти и обновить HTTP Request ноды
  let changedCount = 0;
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters.jsonBody) {
      const jsonBody = node.parameters.jsonBody;
      
      if (jsonBody.includes('"per_page":50')) {
        node.parameters.jsonBody = jsonBody.replace('"per_page":50', '"per_page":500');
        console.log(`   ✅ ${node.name}: per_page 50 → 500`);
        changedCount++;
      } else if (jsonBody.includes('"per_page":500')) {
        console.log(`   ⏭️  ${node.name}: уже per_page=500`);
      }
    }
  });

  if (changedCount === 0) {
    console.log(`   ⏭️  Изменений не требуется`);
    return;
  }

  // 3. Подготовить данные для обновления (без id, active, staticData!)
  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };

  // 4. Отправить обновление
  const updateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
  }

  console.log(`   ✅ Workflow обновлен (${changedCount} нод изменено)`);
}

async function main() {
  console.log('🚀 Обновление per_page в workflow неактивных броней...');

  for (const workflow of WORKFLOWS) {
    try {
      await updateWorkflow(workflow.id, workflow.name);
    } catch (error) {
      console.error(`\n❌ Ошибка при обновлении ${workflow.name}:`);
      console.error(`   ${error.message}`);
    }
  }

  console.log('\n✅ Все workflow обработаны!');
}

main().catch(error => {
  console.error('\n❌ Критическая ошибка:', error.message);
  process.exit(1);
});

