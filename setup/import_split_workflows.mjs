import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

async function importWorkflow(filePath, workflowName) {
  console.log(`\n📦 Импортируем workflow: ${workflowName}`);
  
  const fullPath = join(projectRoot, filePath);
  const workflowJson = JSON.parse(readFileSync(fullPath, 'utf-8'));
  
  // Подготавливаем данные для импорта
  const workflowData = {
    name: workflowJson.name,
    nodes: workflowJson.nodes,
    connections: workflowJson.connections,
    settings: workflowJson.settings || { executionOrder: "v1" }
  };
  
  try {
    const response = await fetch(`${N8N_HOST}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const workflowId = result.data?.id || result.id;
    
    console.log(`✅ Workflow создан: ${workflowId}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
    
    // Активируем workflow
    console.log(`🚀 Активируем workflow...`);
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    
    if (!activateResponse.ok) {
      console.log(`⚠️  Не удалось активировать workflow`);
    } else {
      console.log(`✅ Workflow активирован!`);
    }
    
    return workflowId;
    
  } catch (error) {
    console.error(`❌ Ошибка при импорте workflow:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Импорт двух новых workflows');
  console.log('================================\n');
  
  try {
    // Импортируем workflow для кассы
    const cashWorkflowId = await importWorkflow(
      'n8n-workflows/rentprog-monitor-company-cash.json',
      'RentProg Monitor - Company Cash'
    );
    
    // Импортируем workflow для событий
    const eventsWorkflowId = await importWorkflow(
      'n8n-workflows/rentprog-monitor-booking-events.json',
      'RentProg Monitor - Booking Events'
    );
    
    console.log('\n✅ Все workflows импортированы и активированы!');
    console.log(`\n💰 Cash Workflow: ${cashWorkflowId}`);
    console.log(`📅 Events Workflow: ${eventsWorkflowId}`);
    
    console.log('\n⏱️  Оба workflow будут запускаться каждые 3 минуты');
    
  } catch (error) {
    console.error('\n❌ Ошибка при импорте workflows');
    process.exit(1);
  }
}

main();

