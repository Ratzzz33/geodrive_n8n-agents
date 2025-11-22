#!/usr/bin/env node
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

console.log('📋 Копирую workflow парсинга истории операций для автомобилей...\n');

try {
  // Получаем workflow истории операций  
  const sourceId = 'xSjwtwrrWUGcBduU';
  
  console.log(`📥 Загружаю исходный workflow ${sourceId}...`);
  const response = await fetch(`${N8N_HOST}/workflows/${sourceId}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  
  const source = await response.json();
  console.log(`   ✅ Загружено ${source.nodes.length} нод`);
  
  // Ищем HTTP Request ноды с операциями
  const httpNodes = source.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
  
  console.log(`\n📍 Найдено HTTP Request нод: ${httpNodes.length}`);
  
  // Проверяем, какой endpoint используется
  for (const node of httpNodes) {
    console.log(`   ${node.name}:`);
    console.log(`      URL: ${node.parameters.url || 'N/A'}`);
    console.log(`      Method: ${node.parameters.method || 'GET'}`);
    
    if (node.parameters.jsonBody) {
      const body = JSON.parse(node.parameters.jsonBody);
      console.log(`      Body model: ${body.model || 'N/A'}`);
    }
  }
  
  console.log('\n💡 Это тот же самый принцип!');
  console.log('Просто меняем model="operation" → model="car"');
  
} catch (error) {
  console.error('\n❌ Ошибка:', error.message);
  process.exit(1);
}

