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
    const jsonBody = node.parameters.jsonBody;
    
    // Если это n8n expression (начинается с =)
    if (typeof jsonBody === 'string' && jsonBody.startsWith('=')) {
      console.log(`\n  📝 Обрабатываю ноду: ${node.name}`);
      
      let newExpression = jsonBody;
      
      // Если уже есть filters, обновляем
      if (jsonBody.includes('"filters"')) {
        newExpression = jsonBody.replace(
          /"filters":\s*\{[^}]*\}/,
          `"filters":{"start_date_from":"${filterDate}"}`
        );
      } else {
        newExpression = jsonBody.replace(
          /\}$/,
          `,"filters":{"start_date_from":"${filterDate}"}}`
        );
      }
      
      // Уменьшаем per_page до 50
      newExpression = newExpression.replace(
        /"per_page":\s*\d+/,
        '"per_page":50'
      );
      
      node.parameters.jsonBody = newExpression;
      
      console.log(`     ✅ Обновлено`);
      updated++;
    }
  });
  
  console.log(`\n📝 Обновлено HTTP Request нод: ${updated}`);
  
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
  
  // Очищаем settings от лишних полей
  const cleanSettings = {
    executionOrder: workflow.settings?.executionOrder || 'v1'
  };
  
  // Создаем чистый объект для обновления
  const updateData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: cleanSettings
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
  
  console.log('\n💡 ГОТОВО! Теперь workflow:');
  console.log('   ✅ Парсит только последние 30 дней');
  console.log('   ✅ Загружает по 50 записей за раз');
  console.log('   ✅ Запускается каждые 15 минут');
  console.log('\n   Можно активировать для автоматической работы!');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

