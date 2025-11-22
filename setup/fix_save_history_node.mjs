#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'xSjwtwrrWUGcBduU';

async function fixWorkflow() {
  try {
    console.log('🔧 Получаю текущий workflow...');
    
    const getResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Failed to get workflow: ${getResponse.statusText}`);
    }
    
    const workflowData = await getResponse.json();
    
    console.log('Структура ответа:', Object.keys(workflowData));
    
    const workflow = workflowData.data || workflowData;
    
    if (!workflow.nodes) {
      console.log('❌ В ответе нет nodes. Полный ответ:', JSON.stringify(workflowData, null, 2).substring(0, 500));
      throw new Error('Неверная структура ответа API');
    }
    
    console.log('✅ Workflow получен:', workflow.name);
    
    // Найти ноду "Save to History1"
    const nodeIndex = workflow.nodes.findIndex(n => n.id === '4d1b5f5d-8a83-49ec-b9c0-1efcb33578b7');
    
    if (nodeIndex === -1) {
      console.log('❌ Нода "Save to History1" не найдена');
      return;
    }
    
    console.log('📝 Исправляю ноду "Save to History1"...');
    
    // Обновляем параметры ноды на executeQuery
    workflow.nodes[nodeIndex].parameters = {
      resource: 'database',
      operation: 'executeQuery',
      query: `INSERT INTO history (branch, operation_type, operation_id, description, entity_type, entity_id, user_name, created_at, raw_data, matched, processed) 
VALUES (
  '{{ $json.branch }}', 
  '{{ ($json.operation_type || 'unknown').replace(/'/g, "''") }}', 
  {{ $json.operation_id ? "'" + $json.operation_id + "'" : "NULL" }}, 
  '{{ ($json.description || '').replace(/'/g, "''") }}', 
  {{ $json.entity_type ? "'" + $json.entity_type.replace(/'/g, "''") + "'" : "NULL" }}, 
  {{ $json.entity_id ? "'" + $json.entity_id + "'" : "NULL" }}, 
  {{ $json.user_name ? "'" + $json.user_name.replace(/'/g, "''") + "'" : "NULL" }}, 
  '{{ $json.created_at }}', 
  '{{ ($json.raw_data || '{}').replace(/'/g, "''") }}'::jsonb, 
  FALSE, 
  FALSE
) 
ON CONFLICT (branch, operation_id) 
DO UPDATE SET 
  operation_type = EXCLUDED.operation_type, 
  description = EXCLUDED.description, 
  entity_type = EXCLUDED.entity_type, 
  entity_id = EXCLUDED.entity_id, 
  user_name = EXCLUDED.user_name, 
  created_at = EXCLUDED.created_at, 
  raw_data = EXCLUDED.raw_data, 
  ts = NOW()`,
      options: {}
    };
    
    console.log('💾 Сохраняю изменения...');
    
    // Удаляем системные поля
    delete workflow.id;
    delete workflow.versionId;
    delete workflow.updatedAt;
    delete workflow.createdAt;
    
    // Обновляем workflow
    const updateResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
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
      throw new Error(`Failed to update workflow: ${updateResponse.statusText}. ${errorText}`);
    }
    
    console.log('✅ Workflow успешно обновлен!');
    console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fixWorkflow();

