import { readFileSync } from 'fs';

const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

// Читаем ID Error Workflow
const workflowIds = JSON.parse(readFileSync('setup/workflow_ids.json', 'utf8'));
const ERROR_WORKFLOW_ID = workflowIds.errorWorkflowId;

console.log(`🔧 Добавление Error Workflow (ID: ${ERROR_WORKFLOW_ID}) во все workflows...\n`);

// Список критичных workflows для мониторинга
const CRITICAL_WORKFLOWS = [
  'Service Center Processor Rentprog',
  'Tbilisi Processor Rentprog',
  'Batumi Processor Rentprog',
  'Kutaisi Processor Rentprog',
  'RentProg Webhooks Monitor',
  'RentProg Upsert Processor',
  'Health & Status',
  'Sync Progress',
  'Auto Company Cash Parser'
];

async function getAllWorkflows() {
  const response = await fetch(`${N8N_HOST}/workflows`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflows: ${response.status}`);
  }
  
  const result = await response.json();
  return result.data || [];
}

async function updateWorkflowSettings(workflowId, workflowName) {
  // Получаем текущий workflow
  const getResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow ${workflowId}: ${getResponse.status}`);
  }
  
  const workflow = await getResponse.json();
  const wfData = workflow.data || workflow;
  
  // Проверяем, не установлен ли уже Error Workflow
  if (wfData.settings?.errorWorkflow === ERROR_WORKFLOW_ID) {
    console.log(`   ⏭️  ${workflowName} - уже настроен`);
    return { success: true, skipped: true };
  }
  
  // Обновляем settings
  const updatedSettings = {
    ...wfData.settings,
    errorWorkflow: ERROR_WORKFLOW_ID
  };
  
  // Подготавливаем данные для обновления (только нужные поля)
  const updateData = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: updatedSettings
  };
  
  // Отправляем обновление
  const updateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Failed to update: ${error}`);
  }
  
  console.log(`   ✅ ${workflowName} - обновлен`);
  return { success: true, skipped: false };
}

try {
  // Получаем все workflows
  const allWorkflows = await getAllWorkflows();
  console.log(`📋 Найдено workflows: ${allWorkflows.length}\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Обрабатываем только критичные workflows
  for (const wf of allWorkflows) {
    // Пропускаем сам Error Workflow
    if (wf.id === ERROR_WORKFLOW_ID) {
      continue;
    }
    
    // Проверяем, входит ли в список критичных
    const isCritical = CRITICAL_WORKFLOWS.some(name => 
      wf.name.includes(name) || name.includes(wf.name)
    );
    
    if (!isCritical) {
      continue;  // Пропускаем некритичные
    }
    
    try {
      const result = await updateWorkflowSettings(wf.id, wf.name);
      if (result.skipped) {
        skipped++;
      } else {
        updated++;
      }
    } catch (error) {
      console.log(`   ❌ ${wf.name} - ошибка: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n📊 Результаты:');
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ⏭️  Пропущено (уже настроено): ${skipped}`);
  console.log(`   ❌ Ошибок: ${errors}`);
  
  if (updated > 0) {
    console.log('\n✅ Error Workflow успешно добавлен в критичные workflows!');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

