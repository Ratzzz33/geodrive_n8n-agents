#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'xSjwtwrrWUGcBduU';

async function fixLayout() {
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
    
    const workflow = await getResponse.json();
    
    console.log('✅ Workflow получен:', workflow.name);
    console.log('📊 Нод в workflow:', workflow.nodes.length);
    
    // Новое красивое расположение нод
    const newPositions = {
      // Триггер
      'trigger': [240, 400],
      
      // Параллельные ветки подготовки (4 филиала)
      'prep-tbilisi': [440, 160],
      'prep-batumi': [440, 320],
      'prep-kutaisi': [440, 480],
      'prep-service': [440, 640],
      
      // Параллельные HTTP запросы
      'get-tbilisi': [660, 160],
      'get-batumi': [660, 320],
      'get-kutaisi': [660, 480],
      'get-service': [660, 640],
      
      // Merge всех филиалов
      '26e9aca7-cb19-4ed6-9da4-4741b9fe87e5': [880, 400], // Merge All Branches
      
      // Обработка данных
      'merge-and-process': [1080, 400],
      
      // Сохранение в БД (2 ноды последовательно)
      '4d1b5f5d-8a83-49ec-b9c0-1efcb33578b7': [1280, 400], // Save to History1
      'save-history-audit': [1480, 400],
      
      // Обработка результатов
      'pass-through-data': [1680, 400],
      'format-result': [1880, 400],
      
      // Проверка на ошибки
      'if-error': [2080, 400],
      
      // Ветка ошибки (верхняя)
      'send-alert': [2280, 240],
      'throw-error': [2480, 240],
      
      // Ветка успеха (нижняя)
      'e8f10fa0-a3f6-4f66-9d6a-0f85c703a26c': [2280, 560], // Success
      'c700c14f-2f7e-4cb1-88cd-ba6e46667390': [2480, 560]  // Log Success to Health
    };
    
    // Применяем новые позиции
    workflow.nodes.forEach(node => {
      if (newPositions[node.id]) {
        node.position = newPositions[node.id];
        console.log(`📍 ${node.name}: [${newPositions[node.id][0]}, ${newPositions[node.id][1]}]`);
      } else {
        console.log(`⚠️  Нода ${node.name} (${node.id}) не найдена в списке позиций`);
      }
    });
    
    console.log('\n💾 Сохраняю изменения...');
    
    // Удаляем системные поля
    delete workflow.id;
    delete workflow.versionId;
    delete workflow.updatedAt;
    delete workflow.createdAt;
    delete workflow.shared;
    delete workflow.tags;
    delete workflow.triggerCount;
    delete workflow.isArchived;
    delete workflow.meta;
    
    // Обновляем workflow (только необходимые поля)
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
    // Добавляем опциональные поля только если они есть
    if (workflow.staticData && Object.keys(workflow.staticData).length > 0) {
      updateData.staticData = workflow.staticData;
    }
    if (workflow.pinData && Object.keys(workflow.pinData).length > 0) {
      updateData.pinData = workflow.pinData;
    }
    
    const updateResponse = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.statusText}. ${errorText}`);
    }
    
    console.log('\n✅ Расположение нод обновлено!');
    console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
    console.log('\n📐 Структура:');
    console.log('   Триггер → 4 ветки подготовки → 4 HTTP запроса → Merge →');
    console.log('   → Process → Save History → Save Audit → Pass Through →');
    console.log('   → Format → If Error →');
    console.log('      ├─ (error) Send Alert → Throw Error');
    console.log('      └─ (success) Success → Log Health');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fixLayout();

