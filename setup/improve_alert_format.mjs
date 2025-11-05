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

// УЛУЧШЕННЫЙ код для форматирования
const IMPROVED_FORMAT_CODE = `
// Получаем данные после Parse Webhook
const input = $input.first().json;
const branch = '{{BRANCH}}'; // будет заменено для каждого филиала

// Извлекаем основные данные (с fallback)
const entityType = input.entitytype || input.entity_type || 'unknown';
const operation = input.operation || 'unknown';
const rentprogId = input.rentprogid || input.id || 'N/A';
const payload = input.payload || {};

// Эмодзи по типам
const emojiMap = {
  car: '🚗',
  booking: '📅',
  client: '👤'
};

const emoji = emojiMap[entityType] || '📦';
const eventType = \`\${entityType}.\${operation}\`;

// Формируем заголовок
let message = \`\${emoji} \${branch} | \${eventType}\\n\`;

// Извлекаем название объекта для заголовка (если есть в payload)
let objectName = '';
if (entityType === 'car') {
  objectName = payload.car_name || payload.number || '';
} else if (entityType === 'booking') {
  objectName = \`#\${rentprogId}\`;
  if (payload.car_name) objectName += \` | \${payload.car_name}\`;
} else if (entityType === 'client') {
  const firstName = payload.name || payload.first_name || '';
  const lastName = payload.lastname || payload.last_name || '';
  objectName = \`\${firstName} \${lastName}\`.trim();
}

message += \`🆔 ID: \${rentprogId}\`;
if (objectName) {
  message += \` | \${objectName}\`;
}
message += \`\\n\\n\`;

// Ключевые поля для CREATE событий
const keyFields = {
  car: ['car_name', 'number', 'vin', 'year', 'transmission', 'mileage', 'active', 'state', 'company_id'],
  booking: ['car_id', 'car_name', 'client_id', 'first_name', 'last_name', 'start_date', 'end_date', 'days', 'state', 'price', 'total'],
  client: ['name', 'lastname', 'phone', 'email', 'category', 'passport_number', 'driver_number']
};

// Игнорируемые технические поля (не показываем в алертах)
const ignoredFields = [
  'updated_at', 'created_at', 
  'updated_from_api', 'created_from_api',
  'demo',
  'main_company_id'
];

if (operation === 'update') {
  // Для UPDATE: ищем все поля с массивами [old, new]
  message += \`📝 Изменения:\\n\`;
  
  let changesCount = 0;
  const changes = [];
  
  for (const [key, value] of Object.entries(payload)) {
    // Пропускаем игнорируемые поля
    if (ignoredFields.includes(key)) continue;
    
    // Проверяем, является ли значение массивом с 2 элементами
    if (Array.isArray(value) && value.length === 2) {
      const oldVal = value[0] === null ? 'null' : value[0];
      const newVal = value[1] === null ? 'null' : value[1];
      
      // Показываем изменение, включая случай когда старое значение было null
      changes.push({ key, oldVal, newVal });
      changesCount++;
    }
  }
  
  // Сортируем: сначала важные поля, потом остальные
  const importantFields = keyFields[entityType] || [];
  changes.sort((a, b) => {
    const aImportant = importantFields.includes(a.key);
    const bImportant = importantFields.includes(b.key);
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return 0;
  });
  
  // Показываем изменения (максимум 15 для читаемости)
  const maxChanges = 15;
  for (let i = 0; i < Math.min(changes.length, maxChanges); i++) {
    const { key, oldVal, newVal } = changes[i];
    message += \`• \${key}: \${oldVal} → \${newVal}\\n\`;
  }
  
  if (changes.length > maxChanges) {
    message += \`\\n... и ещё \${changes.length - maxChanges} изменений\\n\`;
  }
  
  if (changesCount === 0) {
    message += \`(нет изменений в формате [old, new])\\n\`;
  }
  
} else if (operation === 'create') {
  // Для CREATE: показываем ключевые поля
  message += \`✨ Новый объект:\\n\`;
  
  const fieldsToShow = keyFields[entityType] || [];
  let shownCount = 0;
  
  for (const field of fieldsToShow) {
    if (payload[field] !== undefined) {
      const value = payload[field] === null ? 'null' : payload[field];
      message += \`• \${field}: \${value}\\n\`;
      shownCount++;
    }
  }
  
  // Если ключевых полей не было, показываем первые 10 полей
  if (shownCount === 0) {
    const allFields = Object.keys(payload)
      .filter(key => !ignoredFields.includes(key))
      .slice(0, 10);
    
    for (const field of allFields) {
      const value = payload[field] === null ? 'null' : payload[field];
      // Не показываем объекты и массивы
      if (typeof value !== 'object') {
        message += \`• \${field}: \${value}\\n\`;
      }
    }
  }
  
} else {
  // Для других событий (delete, etc): показываем основную информацию
  message += \`📦 Операция: \${operation}\\n\`;
  
  // Показываем несколько ключевых полей если есть
  const mainFields = Object.keys(payload)
    .filter(key => !ignoredFields.includes(key))
    .slice(0, 8);
  
  for (const field of mainFields) {
    const value = payload[field];
    if (value !== null && typeof value !== 'object') {
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

async function improveFormatCode(workflowId, branch) {
  console.log(`\n📝 Обновление ${branch}...`);
  
  try {
    const workflow = await getWorkflow(workflowId);
    console.log(`   ✓ Workflow получен`);
    
    // Найти Format Telegram Alert node
    const formatNode = workflow.nodes.find(n => n.name === 'Format Telegram Alert');
    
    if (!formatNode) {
      console.log(`   ⚠️ Format node не найдена`);
      return;
    }
    
    console.log(`   ✓ Format node найдена`);
    
    // Обновить код
    formatNode.parameters.jsCode = IMPROVED_FORMAT_CODE.replace('{{BRANCH}}', branch);
    
    console.log(`   ✓ Код обновлён`);
    
    // Сохранить
    await updateWorkflow(workflowId, workflow);
    console.log(`   ✅ ${branch} обновлён!`);
    
  } catch (error) {
    console.error(`   ❌ Ошибка для ${branch}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Улучшение формата Telegram алертов\n');
  console.log('Новые возможности:');
  console.log('   ✨ Название объекта в заголовке');
  console.log('   ✨ Фильтрация технических полей');
  console.log('   ✨ Приоритет важных полей');
  console.log('   ✨ Ограничение до 15 изменений');
  console.log('   ✨ Fallback для определения entityType и ID\n');
  console.log('='.repeat(60));
  
  for (const wf of WORKFLOWS) {
    await improveFormatCode(wf.id, wf.branch);
  }
  
  console.log('\n✅ Готово!');
  console.log('\n📝 Улучшения:');
  console.log('   - Показывается название объекта (машина, клиент, бронь)');
  console.log('   - Убраны технические поля (updated_at, demo, etc)');
  console.log('   - Важные поля показываются первыми');
  console.log('   - Максимум 15 изменений (чтобы не спамить)');
  console.log('   - Лучшее определение entityType и ID');
  console.log('\n🔗 Проверьте workflows:');
  for (const wf of WORKFLOWS) {
    console.log(`   - ${wf.branch}: https://n8n.rentflow.rentals/workflow/${wf.id}`);
  }
}

main().catch(console.error);

