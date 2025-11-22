/**
 * Проверка ошибки в последнем execution Starline
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

try {
  console.log('🔍 Проверка ошибок в Starline API Sync workflow\n');

  const workflowId = 'Nc5GFhh5Ikhv1ivK';
  
  // Получаем executions
  const response = await fetch(`${N8N_HOST}/executions?workflowId=${workflowId}&limit=10&includeData=true`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const executions = data.data || [];

  console.log(`📊 Последние 10 executions:\n`);
  
  executions.forEach((ex, idx) => {
    const time = new Date(ex.startedAt).toLocaleTimeString('ru-RU');
    const status = ex.status === 'success' ? '✅' : ex.status === 'error' ? '❌' : '💥';
    console.log(`   ${idx + 1}. ${status} ${ex.id} | ${time} | ${ex.status}`);
  });

  // Ищем последний успешный execution
  const successExecution = executions.find(ex => ex.status === 'success');
  
  if (successExecution) {
    console.log(`\n✅ Последний успешный execution: ${successExecution.id}`);
    console.log(`   Время: ${new Date(successExecution.startedAt).toLocaleString('ru-RU')}\n`);
    
    // Проверяем данные
    if (successExecution.data?.resultData?.runData) {
      const nodes = Object.keys(successExecution.data.resultData.runData);
      console.log(`   Ноды: ${nodes.join(', ')}\n`);
      
      for (const nodeName of nodes) {
        const nodeData = successExecution.data.resultData.runData[nodeName];
        if (!nodeData || nodeData.length === 0) continue;
        
        const firstRun = nodeData[0];
        if (!firstRun.data?.main?.[0]) continue;
        
        const items = firstRun.data.main[0];
        console.log(`   📦 "${nodeName}": ${items.length} элементов`);
        
        // Поиск Maserati
        items.forEach((item, i) => {
          const json = item.json;
          const alias = json?.alias || json?.starline_alias || '';
          
          if (alias.toLowerCase().includes('maserati') || alias.includes('686')) {
            console.log(`\n   🏎️  MASERATI найден (элемент ${i}):`);
            console.log(`      Alias: ${alias}`);
            
            const pos = json.pos || json.position;
            if (pos) {
              console.log(`\n      Position:`);
              console.log(`      • sat_qty: ${pos.sat_qty}`);
              console.log(`      • dir: ${pos.dir ?? 'НЕТ'}`);
              console.log(`      • s (СКОРОСТЬ): ${pos.s ?? 'НЕТ ПОЛЯ!'} ${pos.s ? `✅ ${pos.s} км/ч` : '❌'}`);
              
              if (pos.s && pos.s > 0) {
                console.log(`\n      🎉 СКОРОСТЬ ${pos.s} км/ч ЕСТЬ В API!`);
                console.log(`      Проверим сохранилась ли она в БД...`);
              }
            }
          }
        });
      }
    }
  }

  // Ищем crashed execution
  const crashedExecution = executions.find(ex => ex.status === 'crashed' || ex.status === 'error');
  
  if (crashedExecution) {
    console.log(`\n\n💥 Crashed execution: ${crashedExecution.id}`);
    console.log(`   Время: ${new Date(crashedExecution.startedAt).toLocaleString('ru-RU')}`);
    
    // Проверяем ошибку
    if (crashedExecution.data?.resultData?.error) {
      console.log(`\n   ❌ Ошибка:`);
      console.log(`   ${crashedExecution.data.resultData.error.message || crashedExecution.data.resultData.error}`);
    }
    
    // Проверяем lastNodeExecuted
    if (crashedExecution.data?.resultData?.lastNodeExecuted) {
      console.log(`\n   Последняя выполненная нода: ${crashedExecution.data.resultData.lastNodeExecuted}`);
    }
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

