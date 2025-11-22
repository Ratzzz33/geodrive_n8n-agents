#!/usr/bin/env node

// Исправление schedule для workflow синхронизации автомобилей
// 
// Изменения:
// 1. Cron: раз в день → каждые 5 минут
// 2. Активация workflow
// 3. Опционально: удаление ноды "Remove Price Values" для сохранения детальных цен

import https from 'https';

const WORKFLOW_ID = 'ihRLR0QCJySx319b';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('🔧 Исправление schedule для синхронизации автомобилей...\n');

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'n8n.rentflow.rentals',
      port: 443,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function fixCarsWorkflow() {
  try {
    console.log('1️⃣ Получение текущего workflow...');
    const currentWorkflow = await apiRequest('GET', `/workflows/${WORKFLOW_ID}`);
    const workflow = currentWorkflow.data;

    console.log(`   ✅ Workflow: ${workflow.name}`);
    console.log(`   ℹ️  Статус: ${workflow.active ? 'АКТИВЕН' : 'НЕАКТИВЕН'}`);

    // Находим и обновляем Schedule Trigger ноду
    const scheduleNode = workflow.nodes.find(n => n.name === 'Daily Trigger' || n.type === 'n8n-nodes-base.scheduleTrigger');
    
    if (!scheduleNode) {
      throw new Error('Schedule Trigger нода не найдена!');
    }

    const oldCron = scheduleNode.parameters.rule.interval[0].expression;
    console.log(`\n2️⃣ Обновление расписания...`);
    console.log(`   Старое: ${oldCron} (раз в день в 5 AM)`);
    console.log(`   Новое:  */5 * * * * (каждые 5 минут)`);

    // Обновляем cron expression
    scheduleNode.parameters.rule.interval[0].expression = '*/5 * * * *';

    // Опционально: находим и удаляем ноду "Remove Price Values"
    const removePriceValuesIndex = workflow.nodes.findIndex(n => n.name === 'Remove Price Values');
    
    if (removePriceValuesIndex !== -1) {
      console.log(`\n3️⃣ Найдена нода "Remove Price Values"`);
      console.log(`   ❓ Эта нода удаляет price_values, seasons, price_periods из data`);
      console.log(`   ℹ️  Оставляем её пока что (можно удалить позже вручную)`);
      
      // Если хочешь удалить автоматически - раскомментируй:
      // workflow.nodes.splice(removePriceValuesIndex, 1);
      // console.log(`   ✅ Нода удалена!`);
      
      // И нужно обновить connections:
      // const nodeName = workflow.nodes[removePriceValuesIndex].name;
      // // Удалить connections с этой нодой...
    }

    console.log(`\n4️⃣ Сохранение изменений...`);

    // Подготовка данных для обновления
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      active: true // АКТИВИРУЕМ workflow!
    };

    // Обновляем workflow
    const result = await apiRequest('PUT', `/workflows/${WORKFLOW_ID}`, updateData);

    if (result.data) {
      console.log(`   ✅ Workflow обновлен и активирован!`);
      console.log(`\n📊 Результат:`);
      console.log(`   • Расписание: каждые 5 минут`);
      console.log(`   • Статус: АКТИВЕН ✅`);
      console.log(`   • Следующий запуск: через ~5 минут`);
      console.log(`\n🔗 Workflow URL:`);
      console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
      console.log(`\n💡 Теперь workflow будет обновлять данные о машинах каждые 5 минут!`);
      console.log(`   Это позволит получать актуальные изменения по:`);
      console.log(`   • Ценам (deposit, price_hour)`);
      console.log(`   • Статусу (active, state)`);
      console.log(`   • Пробегу (mileage)`);
      console.log(`   • Филиалам (branch_id)`);
    } else {
      throw new Error('Не удалось обновить workflow');
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

fixCarsWorkflow();

