#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const WORKFLOWS = [
  { id: 'YsBma7qYsdsDykTq', branch: 'BATUMI' },
  { id: 'gJPvJwGQSi8455s9', branch: 'KUTAISI' },
  { id: 'PbDKuU06H7s2Oem8', branch: 'SERVICE-CENTER' },
  { id: 'P65bXE5Xhupkxxw6', branch: 'TBILISI' }
];

// Код для форматирования сообщения
const formatAlertCode = `
// Получаем данные из вебхука
const webhookData = $input.first().json;
const branch = '{{BRANCH}}'; // будет заменено для каждого филиала

// Определяем тип события и entity
const eventType = webhookData.type || 'unknown';
const entityId = webhookData.id || 'N/A';

// Эмодзи по типам
const emojiMap = {
  car: '🚗',
  booking: '📅',
  client: '👤'
};

// Определяем entity из типа события
const entity = eventType.split('.')[0] || eventType.split('_')[0];
const emoji = emojiMap[entity] || '📦';

// Формируем заголовок
let message = \`\${emoji} \${branch} | \${eventType}\\n\`;
message += \`🆔 ID: \${entityId}\\n\\n\`;

// Ключевые поля для CREATE событий
const keyFields = {
  car: ['car_name', 'number', 'vin', 'year', 'transmission', 'mileage', 'active', 'state'],
  booking: ['car_id', 'car_name', 'client_id', 'first_name', 'last_name', 'start_date', 'end_date', 'days', 'state', 'price'],
  client: ['name', 'lastname', 'phone', 'email', 'category', 'passport_number', 'driver_number']
};

// Проверяем тип операции
const isUpdate = eventType.includes('update');
const isCreate = eventType.includes('create');

if (isUpdate) {
  // Для UPDATE: ищем все поля с массивами [old, new]
  message += \`📝 Изменения:\\n\`;
  
  let changesCount = 0;
  for (const [key, value] of Object.entries(webhookData)) {
    // Пропускаем системные поля
    if (key === 'type' || key === 'id') continue;
    
    // Проверяем, является ли значение массивом с 2 элементами
    if (Array.isArray(value) && value.length === 2) {
      const oldVal = value[0] === null ? 'null' : value[0];
      const newVal = value[1] === null ? 'null' : value[1];
      message += \`• \${key}: \${oldVal} → \${newVal}\\n\`;
      changesCount++;
    }
  }
  
  if (changesCount === 0) {
    message += \`(нет изменений в массивах)\\n\`;
  }
  
} else if (isCreate) {
  // Для CREATE: показываем ключевые поля
  message += \`✨ Новый объект:\\n\`;
  
  const fieldsToShow = keyFields[entity] || Object.keys(webhookData).slice(0, 10);
  
  for (const field of fieldsToShow) {
    if (webhookData[field] !== undefined) {
      const value = webhookData[field] === null ? 'null' : webhookData[field];
      message += \`• \${field}: \${value}\\n\`;
    }
  }
} else {
  // Для других событий: просто показываем основные поля
  message += \`📦 Данные:\\n\`;
  const mainFields = Object.keys(webhookData).slice(0, 10);
  for (const field of mainFields) {
    if (field !== 'type') {
      const value = webhookData[field] === null ? 'null' : webhookData[field];
      message += \`• \${field}: \${value}\\n\`;
    }
  }
}

return { message };
`;

async function getWorkflow(workflowId) {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workflow: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || data;
}

async function updateWorkflow(workflowId, workflow) {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings || {}
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update workflow: ${response.status}\n${error}`);
  }
  
  return await response.json();
}

async function addTelegramAlertsToWorkflow(workflowId, branch) {
  console.log(`\n📝 Обработка ${branch}...`);
  
  try {
    // 1. Получить workflow
    const workflow = await getWorkflow(workflowId);
    console.log(`   ✓ Workflow получен: ${workflow.nodes.length} nodes`);
    
    // 2. Проверить, есть ли уже ноды для алертов
    const hasAlertNodes = workflow.nodes.some(n => 
      n.name === 'Format Telegram Alert' || n.name === 'Send Telegram Alert'
    );
    
    if (hasAlertNodes) {
      console.log(`   ⚠️ Telegram alert nodes уже существуют, пропускаю`);
      return;
    }
    
    // 3. Найти ноду respond-success для подключения
    const respondNode = workflow.nodes.find(n => n.id === 'respond-success' || n.name.includes('Respond'));
    
    if (!respondNode) {
      console.log(`   ⚠️ Respond node не найдена, пропускаю`);
      return;
    }
    
    console.log(`   ✓ Respond node найдена: ${respondNode.name}`);
    
    // 4. Создать новые ноды
    const formatNode = {
      id: 'format-telegram-alert',
      name: 'Format Telegram Alert',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [respondNode.position[0] + 300, respondNode.position[1] - 200],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: formatAlertCode.replace('{{BRANCH}}', branch)
      }
    };
    
    const sendNode = {
      id: 'send-telegram-alert',
      name: 'Send Telegram Alert',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [respondNode.position[0] + 500, respondNode.position[1] - 200],
      parameters: {
        method: 'POST',
        url: '=https://api.telegram.org/bot{{ $env.TELEGRAM_BOT_TOKEN }}/sendMessage',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ { "chat_id": $env.TELEGRAM_ALERT_CHAT_ID, "text": $json.message, "parse_mode": "HTML" } }}',
        options: {
          response: {
            response: {
              neverError: true
            }
          }
        }
      },
      continueOnFail: true
    };
    
    // 5. Добавить ноды
    workflow.nodes.push(formatNode);
    workflow.nodes.push(sendNode);
    
    // 6. Найти ноду, которая ведёт к respond-success
    // Обычно это insert-fetched или другая нода перед respond
    const insertNode = workflow.nodes.find(n => n.id === 'insert-fetched');
    
    if (!insertNode) {
      console.log(`   ⚠️ Insert node не найдена, connections не обновлены`);
      return;
    }
    
    // 7. Обновить connections
    // Добавляем параллельный путь: insert-fetched -> format -> send
    if (!workflow.connections[insertNode.name]) {
      workflow.connections[insertNode.name] = { main: [[]] };
    }
    
    // Добавить connection к format node
    workflow.connections[insertNode.name].main[0].push({
      node: formatNode.name,
      type: 'main',
      index: 0
    });
    
    // Connection format -> send
    workflow.connections[formatNode.name] = {
      main: [[{
        node: sendNode.name,
        type: 'main',
        index: 0
      }]]
    };
    
    console.log(`   ✓ Nodes добавлены`);
    console.log(`   ✓ Connections обновлены`);
    
    // 8. Сохранить workflow
    await updateWorkflow(workflowId, workflow);
    console.log(`   ✅ ${branch} обновлён!`);
    
  } catch (error) {
    console.error(`   ❌ Ошибка для ${branch}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Добавление Telegram алертов во все processor workflows\n');
  console.log('='.repeat(60));
  
  for (const wf of WORKFLOWS) {
    await addTelegramAlertsToWorkflow(wf.id, wf.branch);
  }
  
  console.log('\n✅ Готово!');
  console.log('\n📝 Проверьте workflows:');
  for (const wf of WORKFLOWS) {
    console.log(`   - ${wf.branch}: https://n8n.rentflow.rentals/workflow/${wf.id}`);
  }
}

main().catch(console.error);

