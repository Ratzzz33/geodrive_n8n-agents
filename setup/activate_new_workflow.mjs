#!/usr/bin/env node
/**
 * Активация нового workflow
 */

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const WORKFLOW_ID = '3IPHDdFvtZlo4vWO';

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
  console.log(`🚀 Активация workflow: ${WORKFLOW_ID}\n`);

  try {
    const result = await activateWorkflow(WORKFLOW_ID);
    const workflow = result.data || result;
    console.log('✅ Workflow активирован успешно!');
    console.log(`   Active: ${workflow.active}`);
    console.log(`   Name: ${workflow.name}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
  } catch (error) {
    console.error(`❌ Ошибка активации: ${error.message}`);
    console.log('\n💡 Попробуйте активировать вручную через UI n8n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Критическая ошибка:', err.message);
  process.exit(1);
});
