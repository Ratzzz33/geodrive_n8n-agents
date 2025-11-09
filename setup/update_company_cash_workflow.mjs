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

async function main() {
  console.log('🔧 Обновляем Company Cash workflow...\n');

  // 1. Найти workflow
  const listRes = await fetch(`${N8N_HOST}/workflows`, { headers });
  const { data: workflows } = await listRes.json();
  const existing = workflows.find(wf => wf.name === 'RentProg Monitor - Company Cash');

  if (!existing) {
    console.error('❌ Workflow не найден!');
    process.exit(1);
  }

  console.log(`✅ Найден workflow: ${existing.name} (${existing.id})\n`);

  // 2. Загрузить новую структуру
  const wfPath = join(__dirname, '..', 'n8n-workflows', 'rentprog-monitor-company-cash.json');
  const newWorkflow = JSON.parse(readFileSync(wfPath, 'utf8'));

  // 3. Обновить
  const updateBody = {
    name: newWorkflow.name,
    nodes: newWorkflow.nodes,
    connections: newWorkflow.connections,
    settings: newWorkflow.settings
  };

  const updateRes = await fetch(`${N8N_HOST}/workflows/${existing.id}`, {
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

  console.log('📊 Что изменилось:');
  console.log('  ✅ Добавлен Split In Batches (batch size = 20)');
  console.log('  ✅ Loop: Save Payment → Split In Batches');
  console.log('  ✅ После всех батчей → Format Result');
  console.log('');
  console.log('Теперь:');
  console.log('  - На входе: 99 items');
  console.log('  - Split делит на батчи по 20');
  console.log('  - Каждый batch сохраняется в БД');
  console.log('  - На выходе: все 99 items сохранены');
  console.log('');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${existing.id}`);
}

main().catch(console.error);

