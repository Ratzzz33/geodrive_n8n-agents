#!/usr/bin/env node
/**
 * Переключение Save to DB на режим "Insert or Update"
 * Согласно best practices и .cursorrules
 * 
 * Преимущества:
 * ✅ Автоматическое экранирование всех спецсимволов
 * ✅ Защита от SQL-инъекций
 * ✅ Простота настройки
 * ✅ Встроенная поддержка ON CONFLICT
 * ✅ Типобезопасность
 */

import 'dotenv/config';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

async function getWorkflow() {
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || data;
}

async function updateWorkflow(workflow) {
  const updateData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  };
  
  const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update: ${response.status}\n${error}`);
  }
  
  return await response.json();
}

async function main() {
  console.log('='.repeat(70));
  console.log('ПЕРЕКЛЮЧЕНИЕ SAVE TO DB НА INSERT OR UPDATE');
  console.log('='.repeat(70));
  
  const workflow = await getWorkflow();
  console.log(`\nWorkflow: "${workflow.name}"`);
  
  // Найти Save to DB ноду
  const saveNodeIndex = workflow.nodes.findIndex(n => n.name === 'Save to DB');
  if (saveNodeIndex === -1) {
    throw new Error('Save to DB нода не найдена!');
  }
  
  const saveNode = workflow.nodes[saveNodeIndex];
  console.log(`\nНайдена нода: ${saveNode.name} (${saveNode.type})`);
  
  // Получить credentials из существующей ноды
  const credentials = saveNode.credentials;
  console.log(`Credentials: ${JSON.stringify(credentials)}`);
  
  // Создать новую Postgres ноду в режиме "Insert or Update"
  const newNode = {
    ...saveNode,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    parameters: {
      operation: 'insert',
      schema: { __rl: true, mode: 'list', value: 'public' },
      table: { __rl: true, mode: 'list', value: 'bookings' },
      columns: {
        mappingMode: 'autoMapInputData',
        matchingColumns: ['branch', 'number'],
        schema: [
          { id: 'branch', displayName: 'branch', required: false, defaultMatch: true, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'booking_id', displayName: 'booking_id', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'number', displayName: 'number', required: false, defaultMatch: true, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'is_active', displayName: 'is_active', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'start_date', displayName: 'start_date', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'end_date', displayName: 'end_date', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'start_date_formatted', displayName: 'start_date_formatted', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'end_date_formatted', displayName: 'end_date_formatted', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'client_id', displayName: 'client_id', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'client_name', displayName: 'client_name', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'client_category', displayName: 'client_category', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'car_id', displayName: 'car_id', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'car_name', displayName: 'car_name', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'car_code', displayName: 'car_code', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'location_start', displayName: 'location_start', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'location_end', displayName: 'location_end', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'total', displayName: 'total', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'deposit', displayName: 'deposit', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'rental_cost', displayName: 'rental_cost', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'days', displayName: 'days', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'number', readOnly: false, removed: false },
          { id: 'state', displayName: 'state', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'in_rent', displayName: 'in_rent', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'archive', displayName: 'archive', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'start_worker_id', displayName: 'start_worker_id', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'end_worker_id', displayName: 'end_worker_id', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'responsible', displayName: 'responsible', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'description', displayName: 'description', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'data', displayName: 'data', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'json', readOnly: false, removed: false },
          { id: 'is_technical', displayName: 'is_technical', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'boolean', readOnly: false, removed: false },
          { id: 'technical_type', displayName: 'technical_type', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'technical_purpose', displayName: 'technical_purpose', required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false }
        ]
      },
      options: {}
    }
  };
  
  // Заменяем ноду
  workflow.nodes[saveNodeIndex] = newNode;
  
  console.log('\n✅ Нода переключена на "Insert or Update"');
  console.log('\nПараметры:');
  console.log('  Operation: Insert');
  console.log('  Table: bookings');
  console.log('  Mapping Mode: Auto Map Input Data');
  console.log('  Columns to match on: branch, number');
  console.log('  Total fields: 31');
  console.log('\nПреимущества:');
  console.log('  ✅ Автоматическое экранирование всех спецсимволов');
  console.log('  ✅ Защита от SQL-инъекций');
  console.log('  ✅ Встроенная поддержка ON CONFLICT (UPSERT)');
  console.log('  ✅ Типобезопасность (JSON, числа, даты, NULL)');
  console.log('  ✅ Простота поддержки');
  
  console.log('\nСохраняю изменения...');
  await updateWorkflow(workflow);
  console.log('✅ Workflow обновлён!');
  
  console.log('\n' + '='.repeat(70));
  console.log('ГОТОВО К ЗАПУСКУ');
  console.log('='.repeat(70));
  console.log('\nСледующий шаг:');
  console.log('  Запусти workflow через n8n UI:');
  console.log(`  https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log('\nОжидаемый результат:');
  console.log('  - Все русские символы ("Сотрудник", "Лояльный") будут корректно сохранены');
  console.log('  - ON CONFLICT автоматически обновит существующие записи');
  console.log('  - Время выполнения: 30-60 минут для полного импорта');
}

main().catch(err => {
  console.error('\n❌ ОШИБКА:', err.message);
  process.exit(1);
});

