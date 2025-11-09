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
  console.log('🔧 Обновляем Company Cash workflow с логированием и branch...\n');

  const wfPath = join(__dirname, '..', 'n8n-workflows', 'rentprog-monitor-company-cash-parallel.json');
  const newWorkflow = JSON.parse(readFileSync(wfPath, 'utf8'));

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

  console.log('✅ Workflow обновлен!\n');
  console.log('Изменения:');
  console.log('  1. ✅ Добавлено расширенное логирование в "Merge & Process"');
  console.log('     - Показывает структуру ответа от каждого филиала');
  console.log('     - Пробует все возможные пути: counts.data, counts, data, array');
  console.log('     - Логирует первые 2 payment из каждого филиала');
  console.log('');
  console.log('  2. ✅ Добавлено поле branch в SQL INSERT');
  console.log('     - Теперь: INSERT INTO payments (branch, sum, cash, ...)');
  console.log('     - ON CONFLICT (branch, created_at, user_id, sum)');
  console.log('');
  console.log('  3. ✅ Добавлены fallback значения для всех полей');
  console.log('     - payment.id || null, payment.sum || 0, etc.');
  console.log('');
  console.log('📋 Следующий шаг:');
  console.log('  1. Запустите workflow');
  console.log('  2. Откройте последнее выполнение');
  console.log('  3. Кликните на "Merge & Process" → View Logs');
  console.log('  4. Скиньте скриншот логов - увидим структуру API ответа');
  console.log('');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
}

main().catch(console.error);

