#!/usr/bin/env node
const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'PbDKuU06H7s2Oem8';

async function restartWorkflow() {
  console.log('\n🔄 Перезапуск workflow...\n');

  try {
    // Деактивировать
    const deactivate = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/deactivate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!deactivate.ok) {
      throw new Error(`Deactivate failed: ${deactivate.status}`);
    }

    console.log('✓ Деактивирован');

    // Активировать
    const activate = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!activate.ok) {
      throw new Error(`Activate failed: ${activate.status}`);
    }

    console.log('✓ Активирован');
    console.log('\n✅ Workflow перезапущен!\n');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

restartWorkflow();
