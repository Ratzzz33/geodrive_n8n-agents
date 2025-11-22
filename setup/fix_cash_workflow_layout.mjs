#!/usr/bin/env node

import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'w8g8cJb0ccReaqIE';

const newLayout = {
  'Every 5 Minutes': [240, 400],
  
  // Ветки подготовки (вертикально)
  'Tbilisi Pages': [480, 200],
  'Batumi Pages': [480, 340],
  'Kutaisi Pages': [480, 480],
  'Service Pages': [480, 620],
  
  // HTTP запросы
  'Get Tbilisi': [720, 200],
  'Get Batumi': [720, 340],
  'Get Kutaisi': [720, 480],
  'Get Service': [720, 620],
  
  // Объединение и обработка
  'Merge All Branches': [960, 410],
  'Merge & Process': [1200, 410],
  
  // Batch insert
  'Prepare Batch Insert': [1440, 300],
  'Save Payment to DB': [1680, 300],
  
  // Проверка ошибок
  'Check DB Errors': [1920, 410],
  
  // Форматирование результата
  'Format Result': [2160, 410],
  
  // Ветвление по ошибкам
  'If Error': [2400, 410],
  
  // Ветка успеха (верх)
  'Success': [2640, 300],
  'Log Success to Health': [2880, 300],
  
  // Ветка ошибки (низ)
  'Send Error Alert': [2640, 520],
  'Mark as Failed': [2880, 520]
};

async function fixLayout() {
  try {
    console.log('🎨 Исправляю layout workflow...\n');
    
    const response = await fetch(`https://n8n.rentflow.rentals/api/v1/workflows/${WORKFLOW_ID}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    const workflow = await response.json();
    
    console.log('📋 Обновляю позиции нод:\n');
    
    let updated = 0;
    workflow.nodes.forEach(node => {
      if (newLayout[node.name]) {
        const oldPos = node.position;
        const newPos = newLayout[node.name];
        node.position = newPos;
        console.log(`   ${node.name}: [${oldPos[0]}, ${oldPos[1]}] → [${newPos[0]}, ${newPos[1]}]`);
        updated++;
      }
    });
    
    console.log(`\n✅ Обновлено нод: ${updated}\n`);
    console.log('💾 Сохраняю изменения...\n');
    
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings
    };
    
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
      throw new Error(`Failed: ${updateResponse.statusText}. ${errorText}`);
    }
    
    console.log('✅ Layout успешно обновлен!');
    console.log('');
    console.log('📐 Структура workflow:');
    console.log('   Триггер → 4 ветки подготовки → 4 HTTP запроса');
    console.log('   → Merge → Process → Batch Insert → Save to DB');
    console.log('   → Check Errors → Format → If Error');
    console.log('   → Success path (верх) / Error path (низ)');
    console.log('');
    console.log('🔗 https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

fixLayout();

