import fs from 'fs';
import fetch from 'node-fetch';

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const BASE_URL = 'https://n8n.rentflow.rentals/api/v1';
const WORKFLOW_ID = 'ihRLR0QCJySx319b';

async function activateWorkflow() {
  try {
    console.log('🔄 Читаю обновленный workflow...');
    const workflowData = JSON.parse(fs.readFileSync('setup/updated_workflow_full.json', 'utf8'));
    
    // Устанавливаем active: true
    workflowData.active = true;
    
    console.log('🔄 Отправляю PUT запрос с active: true...');
    
    const response = await fetch(`${BASE_URL}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowData)
    });

    console.log('📡 Response status:', response.status);
    
    const result = await response.json();
    
    if (result.active === true) {
      console.log('✅ Workflow активирован успешно!');
      console.log(`   URL: https://n8n.rentflow.rentals/workflow/${WORKFLOW_ID}`);
    } else {
      console.log('⚠️  Workflow обновлен, но не активирован');
      console.log('   Active status:', result.active);
    }
  } catch (error) {
    console.error('❌ Ошибка активации:', error.message);
    console.error(error.stack);
  }
}

activateWorkflow();
