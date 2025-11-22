#!/usr/bin/env node
import { writeFileSync } from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

try {
  const response = await fetch(`${N8N_HOST}/workflows/P3BnmX7Nrmh1cusF`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  
  const result = await response.json();
  
  if (result.data) {
    writeFileSync('n8n-workflows/bookings-template.json', JSON.stringify(result.data, null, 2));
    console.log('✅ Template workflow сохранен: n8n-workflows/bookings-template.json');
    console.log(`📊 Нод в workflow: ${result.data.nodes.length}`);
  } else {
    console.error('❌ Ошибка: не удалось получить workflow');
    console.error(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('❌ Ошибка:', error.message);
}

