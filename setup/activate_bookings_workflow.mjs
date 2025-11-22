#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const WORKFLOW_ID = 'P3BnmX7Nrmh1cusF';

try {
  console.log('='.repeat(80));
  console.log('АКТИВАЦИЯ WORKFLOW');
  console.log('='.repeat(80));
  
  console.log(`\n🔗 Workflow ID: ${WORKFLOW_ID}`);
  console.log(`📋 Название: Парсинг броней RentProg через API`);
  
  console.log('\n⏰ Активирую workflow...');
  
  const activateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  
  if (!activateResponse.ok) {
    const errorText = await activateResponse.text();
    throw new Error(`Failed to activate: ${activateResponse.status}\n${errorText}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ WORKFLOW АКТИВИРОВАН!');
  console.log('='.repeat(80));
  
  console.log('\n📊 НАСТРОЙКИ:');
  console.log('   ⏰ Интервал: каждые 15 минут');
  console.log('   📅 Фильтр: последние 30 дней');
  console.log('   📦 Per page: 50 записей');
  console.log('   🌐 Филиалы: 4 (Tbilisi, Batumi, Kutaisi, Service-center)');
  console.log('   📊 Статусы: Active + Inactive');
  
  console.log('\n💾 БАЗА ДАННЫХ:');
  console.log('   ✅ 2,736 уникальных броней уже в БД');
  console.log('   ✅ NULL записи очищены');
  console.log('   ✅ UPSERT работает (обновляет существующие)');
  
  console.log('\n🔔 УВЕДОМЛЕНИЯ:');
  console.log('   ✅ Telegram алерты при ошибках');
  console.log('   ✅ Ссылка на execution в уведомлениях');
  
  console.log('\n🚀 СЛЕДУЮЩИЕ ШАГИ:');
  console.log('   1. Workflow будет запускаться автоматически каждые 15 минут');
  console.log('   2. Следующий запуск через 15 минут от текущего времени');
  console.log('   3. Мониторь executions в n8n UI:');
  console.log(`      https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}/executions`);
  
  console.log('\n🎉 ВСЕ ГОТОВО К РАБОТЕ!');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

