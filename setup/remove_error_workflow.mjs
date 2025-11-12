#!/usr/bin/env node
/**
 * Удаление errorWorkflow из workflow через полное обновление
 */

import https from 'https';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'GMKZJpL9mF1iMEGV';

function n8nRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_HOST);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: { error: body } });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function removeErrorWorkflow() {
  console.log('🔧 Удаление errorWorkflow из workflow...\n');

  // Получаем текущий workflow
  const currentResponse = await n8nRequest('GET', `/workflows/${WORKFLOW_ID}`);
  if (currentResponse.statusCode !== 200) {
    throw new Error(`Ошибка получения workflow: ${currentResponse.statusCode}`);
  }

  const current = currentResponse.data.data;
  
  // Удаляем errorWorkflow из settings
  const fixedSettings = { ...current.settings };
  delete fixedSettings.errorWorkflow;
  
  // Обновляем workflow полностью (сохраняем все ноды и connections)
  const updateData = {
    id: WORKFLOW_ID,
    name: current.name,
    nodes: current.nodes,
    connections: current.connections,
    settings: fixedSettings,
    active: current.active
  };

  console.log('   💾 Обновляю workflow (удаляю errorWorkflow)...');
  const updateResponse = await n8nRequest('PUT', `/workflows/${WORKFLOW_ID}`, updateData);

  if (updateResponse.statusCode >= 200 && updateResponse.statusCode < 300) {
    console.log('   ✅ Workflow исправлен!');
    console.log(`   🔗 URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}\n`);
    return { success: true };
  } else {
    throw new Error(`Ошибка обновления: ${updateResponse.statusCode}\n${JSON.stringify(updateResponse.data, null, 2)}`);
  }
}

removeErrorWorkflow()
  .then(() => {
    console.log('✅ Готово! Workflow должен открываться без ошибок.');
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Ошибка:`, error.message);
    process.exit(1);
  });

