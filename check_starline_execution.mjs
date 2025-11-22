/**
 * Проверка последних executions Starline API Sync workflow
 * Поиск данных по Maserati
 */

import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

try {
  console.log('🔍 Проверка последних executions Starline API Sync\n');

  // Получаем последние executions
  const workflowId = 'Nc5GFhh5Ikhv1ivK';
  const response = await fetch(`${N8N_HOST}/executions?workflowId=${workflowId}&limit=5&includeData=true`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const executions = data.data || [];

  console.log(`✅ Найдено ${executions.length} последних executions\n`);

  if (executions.length === 0) {
    console.log('⚠️  Нет executions для этого workflow');
    process.exit(0);
  }

  // Берем последний execution
  const latest = executions[0];
  console.log(`📊 Последний execution:`);
  console.log(`   ID: ${latest.id}`);
  console.log(`   Время: ${new Date(latest.startedAt).toLocaleString('ru-RU')}`);
  console.log(`   Статус: ${latest.status}`);
  console.log(`   Режим: ${latest.mode}`);
  console.log('');

  // Ищем ноду с данными устройств
  if (latest.data?.resultData?.runData) {
    const nodes = Object.keys(latest.data.resultData.runData);
    console.log(`📋 Ноды в workflow: ${nodes.join(', ')}\n`);

    // Ищем ноду с устройствами
    for (const nodeName of nodes) {
      const nodeData = latest.data.resultData.runData[nodeName];
      if (!nodeData || nodeData.length === 0) continue;

      const firstRun = nodeData[0];
      if (!firstRun.data || !firstRun.data.main || !firstRun.data.main[0]) continue;

      const items = firstRun.data.main[0];
      console.log(`📦 Нода "${nodeName}": ${items.length} элементов\n`);

      // Ищем Maserati в данных
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const json = item.json;

        if (!json) continue;

        // Проверяем разные структуры данных
        const alias = json.alias || json.starline_alias || json.device_alias || '';
        const isMaserati = alias.toLowerCase().includes('maserati') || 
                          alias.includes('686') || 
                          (json.plate && json.plate.includes('686'));

        if (isMaserati) {
          console.log(`🏎️  НАЙДЕН MASERATI (элемент ${i}):\n`);
          console.log(`   Alias: ${alias}`);
          
          // Проверяем наличие данных о скорости
          const pos = json.pos || json.position;
          if (pos) {
            console.log(`\n   📡 Position данные:`);
            console.log(`   • x: ${pos.x}`);
            console.log(`   • y: ${pos.y}`);
            console.log(`   • sat_qty: ${pos.sat_qty}`);
            console.log(`   • ts: ${pos.ts}`);
            console.log(`   • dir: ${pos.dir ?? 'НЕТ'}`);
            console.log(`   • s (СКОРОСТЬ): ${pos.s ?? 'НЕТ ПОЛЯ!'} ${pos.s ? '✅' : '❌'}`);
            console.log(`   • speed (старое): ${pos.speed ?? 'НЕТ'}`);

            if (pos.s) {
              console.log(`\n   🎉 СКОРОСТЬ ЕСТЬ В API: ${pos.s} км/ч`);
            } else {
              console.log(`\n   ❌ ПОЛЯ "s" НЕТ В ОТВЕТЕ API!`);
              console.log(`   Возможные причины:`);
              console.log(`   • Starline не передает скорость для этого устройства`);
              console.log(`   • GPS данные обновляются редко`);
              console.log(`   • Машина движется слишком медленно`);
            }
          }

          // Показываем ВСЕ поля для отладки
          console.log(`\n   📋 Все поля объекта:`);
          console.log(JSON.stringify(json, null, 2).split('\n').slice(0, 50).join('\n'));
          console.log('');
          break;
        }
      }
    }
  } else {
    console.log('⚠️  Нет данных в execution');
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  if (error.stack) console.error(error.stack);
}

