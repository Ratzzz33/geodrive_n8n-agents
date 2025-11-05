#!/usr/bin/env node
/**
 * Проверка executions после определённого времени
 */

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

async function checkExecutions() {
  console.log('\n🔍 Проверка executions после 05:16...\n');

  try {
    const response = await fetch(`${N8N_HOST}/executions?workflowId=${WORKFLOW_ID}&limit=10`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`📊 Найдено executions: ${data.data.length}\n`);
    
    data.data.forEach(ex => {
      const time = new Date(ex.startedAt).toLocaleTimeString('ru-RU');
      console.log(`   ${ex.id}: ${time} - ${ex.status}`);
    });
    
    console.log('\n✅ Проверка завершена\n');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

checkExecutions();

