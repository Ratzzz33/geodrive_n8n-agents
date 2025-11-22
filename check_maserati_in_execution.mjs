/**
 * Проверка данных Maserati в успешном execution
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

try {
  console.log('🏎️  Поиск данных Maserati в успешном execution\n');

  // Получаем конкретный execution
  const executionId = '12353'; // Последний успешный
  const response = await fetch(`${N8N_HOST}/executions/${executionId}?includeData=true`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  const execution = result.data || result;
  
  console.log(`📊 Execution ${executionId}:`);
  console.log(`   Время: ${new Date(execution.startedAt).toLocaleString('ru-RU')}`);
  console.log(`   Статус: ${execution.status}\n`);

  // Проверяем ноду "Split Cars Details"
  const splitNode = execution.data?.resultData?.runData?.['Split Cars Details'];
  
  if (splitNode && splitNode[0]?.data?.main?.[0]) {
    const devices = splitNode[0].data.main[0];
    console.log(`📦 Всего устройств: ${devices.length}\n`);
    
    // Ищем Maserati
    let found = false;
    
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i].json;
      const alias = device.alias || '';
      
      if (alias.toLowerCase().includes('maserati') || alias.includes('686')) {
        found = true;
        console.log(`✅ НАЙДЕН MASERATI (элемент #${i}):\n`);
        console.log(`   Alias: "${alias}"`);
        console.log(`   Device ID: ${device.device_id}`);
        console.log(`   Status: ${device.status}`);
        
        // Проверяем position
        const pos = device.pos || device.position;
        if (pos) {
          console.log(`\n   📡 Position данные:`);
          console.log(`   • x (lng): ${pos.x}`);
          console.log(`   • y (lat): ${pos.y}`);
          console.log(`   • sat_qty: ${pos.sat_qty}`);
          console.log(`   • ts: ${pos.ts} (${new Date(pos.ts * 1000).toLocaleString('ru-RU')})`);
          console.log(`   • dir (направление): ${pos.dir ?? 'НЕТ'}`);
          console.log(`   • s (СКОРОСТЬ): ${pos.s ?? 'НЕТ ПОЛЯ!'}`);
          
          if (pos.s !== undefined && pos.s !== null) {
            console.log(`\n   🎉 СКОРОСТЬ ПРИСУТСТВУЕТ В API: ${pos.s} км/ч ✅`);
            
            if (pos.s > 0) {
              console.log(`   🚗 Машина ДВИЖЕТСЯ со скоростью ${pos.s} км/ч!`);
              console.log(`\n   ❓ ПРОБЛЕМА: Почему скорость не сохраняется в БД?`);
              console.log(`   Нужно проверить:`);
              console.log(`   1. Сохраняется ли это значение в БД через workflow`);
              console.log(`   2. Какая нода отвечает за сохранение в БД`);
              console.log(`   3. Есть ли ошибки при сохранении`);
            } else {
              console.log(`   🅿️ Скорость = 0 (машина стоит)`);
            }
          } else {
            console.log(`\n   ❌ ПОЛЯ "s" НЕТ В ОТВЕТЕ API`);
            console.log(`   Starline не передает скорость для этого устройства`);
          }
        }
        
        // Показываем полный объект для отладки
        console.log(`\n   📋 Полный объект device:`);
        console.log(JSON.stringify(device, null, 2));
        
        break;
      }
    }
    
    if (!found) {
      console.log('❌ Maserati не найден в данных execution');
      console.log('\nПроверяем все alias:');
      devices.slice(0, 10).forEach((d, i) => {
        console.log(`   ${i}. ${d.json.alias}`);
      });
    }
  } else {
    console.log('⚠️  Нет данных в ноде "Split Cars Details"');
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  if (error.response) {
    console.error('Response:', await error.response.text());
  }
}

