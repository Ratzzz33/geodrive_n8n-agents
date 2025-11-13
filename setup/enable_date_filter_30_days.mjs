#!/usr/bin/env node
/**
 * Включение фильтра на последние 30 дней
 * Использовать ПОСЛЕ первого полного прохода
 */

import 'dotenv/config';

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';
const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi5mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('\n📅 Включение фильтра на последние 30 дней...\n');

// Вычисляем дату 30 дней назад
const dateFrom = new Date();
dateFrom.setDate(dateFrom.getDate() - 30);
const dateFromStr = dateFrom.toISOString().split('T')[0];

console.log(`   Фильтр: start_date >= ${dateFromStr}\n`);

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

// Добавляем фильтр во все HTTP Request ноды
const httpNodeNames = [
  'Get Tbilisi Active', 'Get Tbilisi Inactive',
  'Get Batumi Active', 'Get Batumi Inactive',
  'Get Kutaisi Active', 'Get Kutaisi Inactive',
  'Get Service Active', 'Get Service Inactive'
];

workflow.nodes.forEach(node => {
  if (httpNodeNames.includes(node.name)) {
    const jsonBody = JSON.parse(node.parameters.jsonBody.replace('=', ''));
    
    // Добавляем фильтр
    if (!jsonBody.filters) {
      jsonBody.filters = {};
    }
    jsonBody.filters.start_date_from = dateFromStr;
    
    node.parameters.jsonBody = `=${JSON.stringify(jsonBody)}`;
    
    console.log(`✅ ${node.name}: фильтр установлен`);
  }
});

// Обновляем workflow
const updateData = {
  name: workflow.name,
  nodes: workflow.nodes,
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

if (!updateResponse.ok) {
  console.error('❌ Ошибка обновления workflow:', await updateResponse.text());
  process.exit(1);
}

console.log('\n✅ Фильтр на 30 дней включен!\n');
console.log('📋 Теперь workflow будет парсить только брони за последние 30 дней\n');
console.log('🔗 Workflow: https://n8n.rentflow.rentals/workflow/' + WORKFLOW_ID + '\n');

