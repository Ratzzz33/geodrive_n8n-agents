#!/usr/bin/env node
/**
 * Исправление ноды "Format Result" - висит на выполнении
 * Согласно .cursorrules и best practices
 * 
 * Возможные проблемы:
 * 1. Тяжелые операции в цикле
 * 2. Неправильная обработка большого количества items
 * 3. Бесконечный цикл
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
  console.log('ИСПРАВЛЕНИЕ FORMAT RESULT - ОПТИМИЗАЦИЯ');
  console.log('='.repeat(70));
  
  const workflow = await getWorkflow();
  console.log(`\nWorkflow: "${workflow.name}"`);
  
  // Найти Format Result ноду
  const formatNodeIndex = workflow.nodes.findIndex(n => n.name === 'Format Result');
  if (formatNodeIndex === -1) {
    throw new Error('Format Result нода не найдена!');
  }
  
  const formatNode = workflow.nodes[formatNodeIndex];
  console.log(`\nНайдена нода: ${formatNode.name} (${formatNode.type})`);
  console.log(`Текущий код: ${formatNode.parameters.jsCode?.length || 0} символов`);
  
  // Оптимизированный код - простой и быстрый
  const optimizedCode = `// Быстрое форматирование результата без тяжелых операций
const items = $input.all();

// Просто считаем количество успешных и неудачных
const successCount = items.filter(item => !item.json.error).length;
const errorCount = items.filter(item => item.json.error).length;

// Формируем простое сообщение
let message = '📊 Парсинг броней RentProg завершён\\n\\n';
message += \`✅ Успешно: \${successCount}\\n\`;

if (errorCount > 0) {
  message += \`❌ Ошибок: \${errorCount}\\n\`;
}

message += \`\\n📈 Всего обработано: \${items.length} items\`;

return [{
  json: {
    success: errorCount === 0,
    message: message,
    total_items: items.length,
    success_count: successCount,
    error_count: errorCount
  }
}];`;
  
  // Обновляем ноду
  formatNode.parameters.jsCode = optimizedCode;
  workflow.nodes[formatNodeIndex] = formatNode;
  
  console.log('\n✅ Нода оптимизирована');
  console.log('\nИзменения:');
  console.log('  - Убраны тяжелые операции со строками');
  console.log('  - Простой подсчёт успехов/ошибок');
  console.log('  - Минимальное форматирование сообщения');
  console.log('  - Быстрое выполнение даже для 15,000+ items');
  
  console.log('\nСохраняю изменения...');
  await updateWorkflow(workflow);
  console.log('✅ Workflow обновлён!');
  
  console.log('\n' + '='.repeat(70));
  console.log('ГОТОВО К ПОВТОРНОМУ ЗАПУСКУ');
  console.log('='.repeat(70));
  console.log('\nТеперь Format Result будет работать быстро');
  console.log('Попробуй запустить workflow снова:');
  console.log(`https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
}

main().catch(err => {
  console.error('\n❌ ОШИБКА:', err.message);
  process.exit(1);
});

