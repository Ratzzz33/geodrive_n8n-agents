#!/usr/bin/env node
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

try {
  const response = await fetch(`${N8N_HOST}/workflows`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  const result = await response.json();
  
  if (!result.data) {
    console.error('❌ Ошибка:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  
  console.log(`📊 Всего workflows: ${result.data.length}\n`);
  
  // Список всех workflows
  result.data.forEach((w, i) => {
    console.log(`${i + 1}. ${w.name}`);
    console.log(`   ID: ${w.id}`);
    console.log(`   Active: ${w.active ? '✅' : '❌'}`);
    console.log('');
  });
  
  // Ищем workflow для автомобилей
  const carsWorkflow = result.data.find(w => 
    w.name.includes('автомобил') || 
    w.name.includes('Cars') || 
    w.name.includes('🚗')
  );
  
  if (carsWorkflow) {
    console.log('✅ Найден workflow для автомобилей:');
    console.log(`   ID: ${carsWorkflow.id}`);
    console.log(`   Name: ${carsWorkflow.name}`);
    console.log(`   Active: ${carsWorkflow.active}`);
  } else {
    console.log('❌ Workflow для автомобилей не найден');
  }
  
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

