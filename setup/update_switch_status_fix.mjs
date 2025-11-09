import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

const workflowId = 'w8g8cJb0ccReaqIE';

async function main() {
  console.log('🔧 Исправляем Switch node (status вместо payment_id)...\n');

  // Загрузить исправленную структуру
  const wfPath = join(__dirname, '..', 'n8n-workflows', 'rentprog-monitor-company-cash-parallel.json');
  const newWorkflow = JSON.parse(readFileSync(wfPath, 'utf8'));

  // Обновить
  const updateBody = {
    name: newWorkflow.name,
    nodes: newWorkflow.nodes,
    connections: newWorkflow.connections,
    settings: newWorkflow.settings
  };

  const updateRes = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updateBody)
  });

  if (!updateRes.ok) {
    const error = await updateRes.text();
    console.error('❌ Ошибка обновления:', error);
    process.exit(1);
  }

  console.log('✅ Switch node исправлен!\n');
  console.log('Причина проблемы:');
  console.log('  ❌ Было: Switch проверял payment_id === null');
  console.log('  ⚠️  Но payment_id === null для валидных записей!');
  console.log('  ⚠️  234 items шли в "No Data" вместо "Split In Batches"');
  console.log('');
  console.log('Исправление:');
  console.log('  ✅ Теперь: Switch проверяет status === "no_data"');
  console.log('  ✅ Только пустые ответы → No Data');
  console.log('  ✅ Все валидные записи (даже с payment_id=null) → Split In Batches');
  console.log('');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
}

main().catch(console.error);

