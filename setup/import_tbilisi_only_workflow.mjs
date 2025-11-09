import fs from 'fs';
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const WORKFLOW_FILE = 'n8n-workflows/rentprog-history-parser-tbilisi-only.json';
const WORKFLOW_NAME = 'RentProg History Parser - Tbilisi Only';

async function main() {
  console.log('🚀 Импорт workflow для Tbilisi...\n');

  // Читаем workflow
  const workflowData = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));

  // Ищем существующий workflow
  const existingResponse = await fetch(`${N8N_HOST}/workflows`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });

  const existing = await existingResponse.json();
  const found = existing.data.find(wf => wf.name === WORKFLOW_NAME);

  let workflowId;

  if (found) {
    console.log(`📝 Обновляем существующий workflow (${found.id})...`);
    
    // Убираем read-only поля
    const { id, active, ...workflowToUpdate } = workflowData;
    
    const updateResponse = await fetch(`${N8N_HOST}/workflows/${found.id}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowToUpdate)
    });

    const result = await updateResponse.json();
    
    if (!updateResponse.ok) {
      console.error('Ошибка обновления:', result);
      throw new Error(`Failed to update workflow: ${result.message}`);
    }
    
    workflowId = result.data?.id || result.id || found.id;
    console.log(`✅ Workflow обновлен: ${workflowId}`);
    
  } else {
    console.log(`📝 Создаем новый workflow...`);
    
    // Убираем поле active перед отправкой
    const { active, ...workflowToCreate } = workflowData;
    
    const createResponse = await fetch(`${N8N_HOST}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowToCreate)
    });

    const result = await createResponse.json();
    
    if (!createResponse.ok) {
      console.error('Ошибка:', result);
      throw new Error(`Failed to create workflow: ${result.message}`);
    }
    
    workflowId = result.data?.id || result.id;
    console.log(`✅ Workflow создан: ${workflowId}`);
    
    // Активируем
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (activateResponse.ok) {
      console.log(`✅ Workflow активирован`);
    } else {
      const activateError = await activateResponse.json();
      console.error('Ошибка активации:', activateError);
    }
  }

  console.log(`\n🌐 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
  console.log(`\n⏰ Следующее выполнение через 3 минуты`);
}

main().catch(console.error);

