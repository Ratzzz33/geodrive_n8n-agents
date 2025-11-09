#!/usr/bin/env node

/**
 * Настройка Error Workflow для всех существующих n8n workflows
 * 
 * Что делает:
 * 1. Включает сохранение ВСЕХ исполнений (успешных и с ошибками)
 * 2. Устанавливает Error Handler workflow (H3UBEp425F5SMyrX)
 */

const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const ERROR_WORKFLOW_ID = 'H3UBEp425F5SMyrX';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

async function listWorkflows() {
  const response = await fetch(`${N8N_API_URL}/workflows?limit=100`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Failed to list workflows: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

async function getWorkflow(id) {
  const response = await fetch(`${N8N_API_URL}/workflows/${id}`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow ${id}: ${response.statusText}`);
  }
  
  const data = await response.json();
  // API возвращает либо data.data, либо просто data
  return data.data || data;
}

async function updateWorkflow(id, workflow) {
  const response = await fetch(`${N8N_API_URL}/workflows/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(workflow)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update workflow ${id}: ${response.statusText}\n${errorText}`);
  }
  
  return await response.json();
}

async function configureErrorHandling() {
  console.log('🔍 Получение списка workflows...\n');
  
  const workflows = await listWorkflows();
  console.log(`Найдено workflows: ${workflows.length}\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const wf of workflows) {
    // Пропускаем сам Error Handler
    if (wf.id === ERROR_WORKFLOW_ID) {
      console.log(`⏭️  SKIP: "${wf.name}" (это сам Error Handler)\n`);
      skipped++;
      continue;
    }
    
    // Пропускаем старый Error Handler (если есть дубликат)
    if (wf.name === 'Error Handler - AI Agent' && wf.id !== ERROR_WORKFLOW_ID) {
      console.log(`⏭️  SKIP: "${wf.name}" (старая версия, ID: ${wf.id})\n`);
      skipped++;
      continue;
    }
    
    console.log(`⚙️  Обработка: "${wf.name}" (${wf.id})...`);
    
    try {
      // Получаем полные данные workflow
      const fullWorkflow = await getWorkflow(wf.id);
      
      // Проверяем текущие настройки
      const currentSettings = fullWorkflow.settings || {};
      const needsUpdate = 
        currentSettings.errorWorkflow !== ERROR_WORKFLOW_ID ||
        currentSettings.saveDataErrorExecution !== 'all' ||
        currentSettings.saveDataSuccessExecution !== 'all' ||
        currentSettings.saveManualExecutions !== true;
      
      if (!needsUpdate) {
        console.log(`   ✅ Уже настроен корректно\n`);
        skipped++;
        continue;
      }
      
      // Обновляем настройки
      const updatedSettings = {
        ...currentSettings,
        errorWorkflow: ERROR_WORKFLOW_ID,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        saveManualExecutions: true
      };
      
      // Подготавливаем данные для обновления (только необходимые поля)
      const updateData = {
        name: fullWorkflow.name,
        nodes: fullWorkflow.nodes,
        connections: fullWorkflow.connections,
        settings: updatedSettings
      };
      
      // Обновляем workflow
      await updateWorkflow(wf.id, updateData);
      
      console.log(`   ✅ Успешно обновлен:`);
      console.log(`      - Error Workflow: ${ERROR_WORKFLOW_ID}`);
      console.log(`      - Save errors: all`);
      console.log(`      - Save success: all`);
      console.log(`      - Save manual: true\n`);
      
      updated++;
      
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}\n`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ИТОГО:');
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  console.log(`   ❌ Ошибок: ${errors}`);
  console.log('='.repeat(60) + '\n');
  
  if (errors > 0) {
    console.error('⚠️  Некоторые workflows не удалось обновить. Проверьте ошибки выше.');
    process.exit(1);
  }
  
  console.log('✅ Все workflows успешно настроены!\n');
}

// Запуск
configureErrorHandling().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});

