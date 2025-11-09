import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

const WORKFLOW_ID = "xSjwtwrrWUGcBduU"; // RentProg Monitor - Booking Events

async function updateWorkflow() {
  console.log('📦 Обновляем workflow на History Parser...\n');
  
  // Читаем новый workflow
  const workflowFile = join(projectRoot, 'n8n-workflows', 'rentprog-history-parser-v2.json');
  const workflowJson = JSON.parse(readFileSync(workflowFile, 'utf-8'));
  
  console.log(`✅ Workflow загружен: ${workflowJson.name}`);
  console.log(`   Нод: ${workflowJson.nodes.length}`);
  
  // Подготавливаем данные для обновления
  const workflowData = {
    name: workflowJson.name,
    nodes: workflowJson.nodes,
    connections: workflowJson.connections,
    settings: workflowJson.settings
  };
  
  try {
    console.log(`\n🔄 Обновляем workflow ${WORKFLOW_ID}...`);
    
    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
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
    const workflowData2 = result.data || result;
    
    console.log('✅ Workflow успешно обновлен!');
    console.log(`   ID: ${workflowData2.id}`);
    console.log(`   Имя: ${workflowData2.name}`);
    console.log(`   URL: https://n8n.rentflow.rentals/workflow/${workflowData2.id}`);
    
    // Активируем workflow
    console.log(`\n🚀 Активируем workflow...`);
    const activateResponse = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}/activate`, {
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
    
    console.log('\n📊 Что изменилось:');
    console.log('  ❌ Парсинг броней (/bookings)');
    console.log('  ✅ Парсинг истории операций (POST /search_operations)');
    console.log('  ✅ 3 страницы по 50 операций = 150 за запуск');
    console.log('  ✅ 4 филиала × 3 страницы = 12 HTTP запросов');
    console.log('  ✅ Сохранение в таблицу history');
    console.log('  ✅ Поля: matched, processed для ручного анализа');
    
    console.log('\n📝 Следующие шаги:');
    console.log('  1. Дождаться первого execution (~3 минуты)');
    console.log('  2. Проверить таблицу history в БД (должно быть ~600 записей)');
    console.log('  3. Начать ручной анализ в чате');
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении workflow:', error.message);
    throw error;
  }
}

updateWorkflow();

