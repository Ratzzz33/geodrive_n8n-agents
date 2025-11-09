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
  console.log('🔧 Улучшаем дедупликацию в Save Payment to DB...\n');

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

  console.log('✅ Дедупликация исправлена!\n');
  console.log('Изменения в SQL:');
  console.log('');
  console.log('  1. ✅ Добавлено поле payment_id в INSERT');
  console.log('     - Теперь сохраняем ID платежа из RentProg');
  console.log('');
  console.log('  2. ✅ Изменён ON CONFLICT на (branch, payment_id)');
  console.log('     ❌ Было: (branch, created_at, user_id, sum)');
  console.log('     ✅ Стало: (branch, payment_id)');
  console.log('     - payment_id уникален внутри филиала');
  console.log('     - Надёжная защита от дублей');
  console.log('');
  console.log('  3. ✅ DO UPDATE обновляет все важные поля');
  console.log('     - sum, cash, cashless, description, raw_data');
  console.log('     - Если данные изменились в RentProg');
  console.log('');
  console.log('Теперь:');
  console.log('  • Первый запуск → INSERT новой записи');
  console.log('  • Повторный запуск → UPDATE существующей');
  console.log('  • Никаких дублей по payment_id!');
  console.log('');
  console.log('⚠️  ВАЖНО:');
  console.log('  Проверьте что в таблице payments есть:');
  console.log('  • Поле payment_id (INT или BIGINT)');
  console.log('  • UNIQUE constraint на (branch, payment_id)');
  console.log('');
  console.log('  Если нет - создайте миграцию:');
  console.log('  ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_id BIGINT;');
  console.log('  CREATE UNIQUE INDEX IF NOT EXISTS payments_branch_payment_id_unique');
  console.log('    ON payments (branch, payment_id);');
  console.log('');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
}

main().catch(console.error);

