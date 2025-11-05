#!/usr/bin/env node
/**
 * Активация workflow для всех филиалов
 */

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';

const workflows = [
  { id: 'P65bXE5Xhupkxxw6', name: 'Tbilisi Processor Rentprog' },
  { id: 'YsBma7qYsdsDykTq', name: 'Batumi Processor Rentprog' },
  { id: 'gJPvJwGQSi8455s9', name: 'Kutaisi Processor Rentprog' }
];

async function activateWorkflow(workflowId) {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${error.substring(0, 300)}`);
  }

  return await response.json();
}

async function main() {
  console.log('🚀 Активация workflow для всех филиалов...\n');

  const results = [];

  for (const wf of workflows) {
    console.log(`🔧 Активация: ${wf.name} (${wf.id})`);
    
    try {
      await activateWorkflow(wf.id);
      console.log(`   ✅ Активирован`);
      results.push({ ...wf, success: true });
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}`);
      results.push({ ...wf, error: error.message, success: false });
    }
  }

  console.log('\n\n📊 Результаты:');
  console.log('─'.repeat(50));
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.name}: активирован`);
    } else {
      console.log(`❌ ${r.name}: ${r.error}`);
    }
  });
  console.log('─'.repeat(50));

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Успешно активировано: ${successCount}/${workflows.length}\n`);
}

main().catch(err => {
  console.error('\n❌ Критическая ошибка:', err.message);
  process.exit(1);
});
