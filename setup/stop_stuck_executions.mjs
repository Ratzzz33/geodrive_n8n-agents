#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const executions = [10688, 10675];

console.log('\n🛑 Остановка зависших executions...\n');

for (const id of executions) {
  try {
    const response = await fetch(`${N8N_API_URL}/executions/${id}/stop`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log(`✅ Execution ${id} остановлен`);
    } else {
      console.log(`⚠️  Execution ${id}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Execution ${id}: ${error.message}`);
  }
}

console.log('\n✅ Готово!\n');

