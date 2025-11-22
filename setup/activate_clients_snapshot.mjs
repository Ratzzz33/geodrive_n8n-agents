#!/usr/bin/env node

import https from 'https';

const WORKFLOW_ID = 'bQMfrHfat23xYQx4';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('⚡ Активация Clients Snapshot workflow...\n');

const options = {
  hostname: 'n8n.rentflow.rentals',
  port: 443,
  path: `/api/v1/workflows/${WORKFLOW_ID}/activate`,
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.data?.active === true) {
        console.log('✅ Workflow активирован!');
        console.log(`\n📅 Следующий автоматический запуск: сегодня в 3:00 AM`);
        console.log(`\n🔗 Workflow URL:`);
        console.log(`   https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
        console.log(`\n📖 Для ручного запуска:`);
        console.log(`   1. Открой URL выше`);
        console.log(`   2. Нажми "Test workflow" → "Execute workflow"`);
      } else {
        console.error('❌ Ошибка активации:', JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('❌ Ошибка парсинга ответа:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
  process.exit(1);
});

req.end();

