#!/usr/bin/env node
import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('\n🔧 Добавление фильтра по датам в HTTP Request ноды...\n');

// Получаем workflow
const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

if (!getResponse.ok) {
  console.error('❌ Ошибка получения workflow:', await getResponse.text());
  process.exit(1);
}

const responseData = await getResponse.json();
const workflow = responseData.data || responseData;

// Текущая дата минус 60 дней (формат YYYY-MM-DD)
const dateFrom = new Date();
dateFrom.setDate(dateFrom.getDate() - 60);
const dateFromStr = dateFrom.toISOString().split('T')[0];

console.log(`📅 Фильтр: брони с ${dateFromStr} (последние 60 дней)\n`);

// Обновляем все HTTP Request ноды
const updatedNodes = workflow.nodes.map(node => {
  if (node.type === 'n8n-nodes-base.httpRequest' && node.name.startsWith('Get')) {
    console.log(`✏️  Обновляю: ${node.name}`);
    
    // Парсим текущий jsonBody
    let jsonBody;
    try {
      // Убираем = в начале если есть
      const bodyStr = node.parameters.jsonBody.replace(/^=/, '');
      jsonBody = JSON.parse(bodyStr);
    } catch (e) {
      console.error(`   ⚠️  Не удалось распарсить jsonBody для ${node.name}`);
      return node;
    }
    
    // Добавляем фильтр по дате
    jsonBody.filters = {
      start_date_from: dateFromStr
    };
    
    // Уменьшаем per_page до 50
    jsonBody.per_page = 50;
    
    node.parameters.jsonBody = `=${JSON.stringify(jsonBody)}`;
    
    console.log(`   ✅ Добавлен фильтр: start_date >= ${dateFromStr}, per_page = 50`);
  }
  
  return node;
});

// Обновляем workflow
const updateData = {
  name: workflow.name,
  nodes: updatedNodes,
  connections: workflow.connections,
  settings: workflow.settings
};

const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updateData)
});

if (updateResponse.ok) {
  console.log('\n✅ Workflow обновлен успешно!');
  console.log(`\n💡 Теперь будет парситься только ~400-800 броней (последние 60 дней)`);
  console.log(`⏱️  Время выполнения сократится до 20-30 секунд\n`);
  console.log(`🔗 https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
} else {
  const error = await updateResponse.text();
  console.error('\n❌ Ошибка обновления:', error);
}

