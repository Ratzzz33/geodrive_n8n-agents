// Проверка execution 52
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const executionId = process.argv[2] || '54';

console.log(`🔍 Проверка execution ${executionId}...\n`);

try {
  const response = await fetch(`${N8N_HOST}/executions/${executionId}?includeData=true`, { headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Ошибка: ${response.status} ${response.statusText}`);
    console.error(errorText);
    process.exit(1);
  }
  
  const result = await response.json();
  
  // n8n API возвращает execution напрямую в result, а не в result.data
  const exec = result;
  
  if (!exec) {
    console.log('❌ Execution не найден. Полный ответ:');
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  
  console.log('\n📊 Основная информация:');
  console.log(`   ID: ${exec.id}`);
  console.log(`   Статус: ${exec.status}`);
  console.log(`   Завершен: ${exec.finished ? 'Да' : 'Нет'}`);
  console.log(`   Режим: ${exec.mode}`);
  
  // Проверяем наличие данных о выполнении
  const executionData = exec.data;
  
  if (executionData && executionData.resultData && executionData.resultData.runData) {
    const runData = executionData.resultData.runData;
    
    console.log('\n📋 Ноды в execution:');
    Object.keys(runData).forEach(nodeName => {
      console.log(`   - ${nodeName}`);
    });
    
      // Проверяем ноду "Set Query Params"
      if (runData['Set Query Params']) {
        console.log('\n🔧 Детали ноды "Set Query Params":');
        const setParamsData = runData['Set Query Params'][0];
        if (setParamsData.data && setParamsData.data.main && setParamsData.data.main[0]) {
          const output = setParamsData.data.main[0][0];
          console.log('   Output:', JSON.stringify(output, null, 2));
        }
      }
      
      // Проверяем ноду "Save Event"
      if (runData['Save Event']) {
      console.log('\n🎯 Детали ноды "Save Event":');
      const saveEventData = runData['Save Event'][0];
      
      if (saveEventData.error) {
        console.log('   ❌ ОШИБКА:');
        console.log(`      Сообщение: ${saveEventData.error.message}`);
        console.log(`      Тип: ${saveEventData.error.name}`);
        if (saveEventData.error.stack) {
          console.log(`      Stack:\n${saveEventData.error.stack.substring(0, 1000)}`);
        }
      } else {
        console.log('   ✅ Нода выполнилась успешно');
        
        if (saveEventData.data && saveEventData.data.main && saveEventData.data.main[0]) {
          const output = saveEventData.data.main[0][0];
          console.log('   📤 Output:');
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log('   ⚠️  Нет output данных');
        }
      }
      
      // Показываем executionStatus
      if (saveEventData.executionStatus) {
        console.log(`   Статус выполнения: ${saveEventData.executionStatus}`);
      }
    } else {
      console.log('\n⚠️  Нода "Save Event" не найдена в результатах выполнения');
      console.log('   Доступные ноды:', Object.keys(runData).join(', '));
    }
  } else {
    console.log('\n⚠️  Нет данных о выполнении нод');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error.stack);
  process.exit(1);
}

