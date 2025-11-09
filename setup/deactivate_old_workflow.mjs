import fetch from 'node-fetch';

const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

const OLD_WORKFLOW_ID = "K9e80NPPxABA4aJy"; // RentProg Monitor - Cash & Events

async function deactivateWorkflow(workflowId) {
  console.log(`🔄 Деактивируем старый workflow: ${workflowId}`);
  
  try {
    // Получаем текущий workflow
    const getResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Не удалось получить workflow: ${getResponse.status}`);
    }
    
    const workflow = await getResponse.json();
    const workflowData = workflow.data || workflow;
    
    console.log(`   Имя: ${workflowData.name}`);
    console.log(`   Статус: ${workflowData.active ? 'АКТИВЕН' : 'НЕАКТИВЕН'}`);
    
    if (!workflowData.active) {
      console.log(`✅ Workflow уже деактивирован`);
      return;
    }
    
    // Деактивируем
    const deactivateResponse = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        active: false
      })
    });
    
    if (!deactivateResponse.ok) {
      const errorText = await deactivateResponse.text();
      throw new Error(`HTTP ${deactivateResponse.status}: ${errorText}`);
    }
    
    console.log(`✅ Workflow деактивирован!`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
    
  } catch (error) {
    console.error(`❌ Ошибка:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🗑️  Деактивация старого workflow');
  console.log('=================================\n');
  
  try {
    await deactivateWorkflow(OLD_WORKFLOW_ID);
    
    console.log('\n✅ Готово!');
    console.log('\n📝 Теперь работают два новых workflow:');
    console.log('   💰 RentProg Monitor - Company Cash (каждые 3 минуты)');
    console.log('   📅 RentProg Monitor - Booking Events (каждые 3 минуты)');
    console.log('\n⚠️  Старый workflow можно удалить через неделю после проверки');
    
  } catch (error) {
    console.error('\n❌ Ошибка при деактивации workflow');
    process.exit(1);
  }
}

main();

