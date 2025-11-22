#!/usr/bin/env node

/**
 * Исправление ноды "Save to DB" - сохранение data как JSON строки
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

const WORKFLOW_ID = 'rCCVTgR2FcWWRxpq';

async function main() {
  try {
    console.log('📥 Получение workflow...\n');
    
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get workflow: ${response.statusText}`);
    }
    
    const result = await response.json();
    const wfData = result.data || result;
    
    // Находим ноду "Save to DB"
    const saveNodeIndex = wfData.nodes.findIndex(n => n.name === 'Save to DB');
    
    if (saveNodeIndex === -1) {
      throw new Error('Нода "Save to DB" не найдена');
    }
    
    const saveNode = wfData.nodes[saveNodeIndex];
    
    console.log('🔍 Текущий маппинг data:');
    console.log(`   "${saveNode.parameters.columns.value.data}"\n`);
    
    // Меняем маппинг data на payload_json
    saveNode.parameters.columns.value.data = '={{ $json.payload_json }}';
    
    console.log('✅ Новый маппинг data:');
    console.log(`   "${saveNode.parameters.columns.value.data}"\n`);
    
    // Обновляем workflow
    console.log('💾 Сохранение изменений...\n');
    
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: wfData.name,
        nodes: wfData.nodes,
        connections: wfData.connections,
        settings: wfData.settings,
      }),
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
    }
    
    console.log('✅ Workflow успешно обновлен!');
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

