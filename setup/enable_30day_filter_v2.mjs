#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

try {
  console.log('='.repeat(80));
  console.log('ВКЛЮЧЕНИЕ ФИЛЬТРА ПО ДАТАМ (ПОСЛЕДНИЕ 30 ДНЕЙ)');
  console.log('='.repeat(80));
  
  // Получаем workflow
  console.log('\n📥 Получаю текущий workflow...');
  const getResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'GET',
    headers
  });
  
  if (!getResponse.ok) {
    throw new Error(`Failed to get workflow: ${getResponse.status} ${getResponse.statusText}`);
  }
  
  const responseData = await getResponse.json();
  const workflow = responseData.data || responseData;
  
  console.log(`✅ Workflow получен: ${workflow.name}`);
  
  // Вычисляем дату 30 дней назад
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  const filterDate = date30DaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
  
  console.log(`\n📅 Фильтр по дате: start_date_from >= ${filterDate}`);
  
  // Находим все HTTP Request ноды для RentProg API
  const httpNodes = workflow.nodes.filter(node => 
    node.type === 'n8n-nodes-base.httpRequest' &&
    node.parameters?.url?.includes('rentprog.net/api/v1/index_with_search')
  );
  
  console.log(`\n🔍 Найдено HTTP Request нод: ${httpNodes.length}`);
  
  let updated = 0;
  
  // Обновляем каждую ноду
  httpNodes.forEach(node => {
    let jsonBody;
    
    // Безопасный парсинг jsonBody
    try {
      if (typeof node.parameters.jsonBody === 'string') {
        // Проверяем, не является ли это n8n expression (начинается с =)
        if (node.parameters.jsonBody.startsWith('=')) {
          console.log(`  ⚠️  Пропускаю ноду ${node.name}: использует n8n expression`);
          return;
        }
        jsonBody = JSON.parse(node.parameters.jsonBody);
      } else if (typeof node.parameters.jsonBody === 'object') {
        jsonBody = node.parameters.jsonBody;
      } else {
        jsonBody = {};
      }
    } catch (e) {
      console.log(`  ⚠️  Ошибка парсинга jsonBody в ноде ${node.name}: ${e.message}`);
      return;
    }
    
    // Добавляем фильтр по дате
    jsonBody.filters = jsonBody.filters || {};
    jsonBody.filters.start_date_from = filterDate;
    
    // Уменьшаем per_page для экономии (30 дней = меньше данных)
    jsonBody.per_page = 50;
    
    // Сохраняем обратно как строку
    node.parameters.jsonBody = JSON.stringify(jsonBody);
    
    console.log(`  ✅ Обновлена нода: ${node.name}`);
    updated++;
  });
  
  console.log(`\n📝 Обновлено нод: ${updated}`);
  
  if (updated === 0) {
    console.log('\n⚠️  Не удалось обновить ни одной ноды.');
    console.log('    Возможно, они используют n8n expressions.');
    console.log('    Нужно обновить вручную через UI.');
    process.exit(1);
  }
  
  // Обновляем Schedule Trigger - меняем на каждые 15 минут
  const scheduleTrigger = workflow.nodes.find(node => 
    node.type === 'n8n-nodes-base.scheduleTrigger'
  );
  
  if (scheduleTrigger) {
    console.log(`\n⏰ Настраиваю Schedule Trigger на каждые 15 минут...`);
    
    scheduleTrigger.parameters.rule = {
      interval: [{
        field: 'minutes',
        minutesInterval: 15
      }]
    };
    
    console.log('  ✅ Schedule Trigger обновлен: каждые 15 минут');
  }
  
  // Создаем чистый объект для обновления
  const updateData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || { executionOrder: 'v1' }
  };
  
  // Отправляем обновление
  console.log('\n📤 Отправляю обновления в n8n...');
  
  const updateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updateData)
  });
  
  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update: ${updateResponse.status}\n${errorText}`);
  }
  
  const updated_workflow = await updateResponse.json();
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ УСПЕШНО ОБНОВЛЕНО!');
  console.log('='.repeat(80));
  
  console.log(`\n📋 Workflow: ${workflow.name}`);
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
  console.log(`\n📅 Фильтр: последние 30 дней (с ${filterDate})`);
  console.log(`📦 Per page: 50`);
  console.log(`⏰ Интервал: каждые 15 минут`);
  
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('   1. Проверь workflow в UI');
  console.log('   2. Запусти вручную для теста');
  console.log('   3. Активируй для автоматического запуска');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

