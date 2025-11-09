import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('🚀 Обновляем на параллельную структуру (4 ноды Get Operations)...\n');

  // 1. Найти workflow
  const listRes = await fetch(`${N8N_HOST}/workflows`, { headers });
  const { data: workflows } = await listRes.json();
  const existing = workflows.find(wf => wf.name === 'RentProg History Parser');

  if (!existing) {
    console.error('❌ Workflow не найден!');
    process.exit(1);
  }

  console.log(`✅ Найден workflow: ${existing.name} (${existing.id})\n`);

  // 2. Загрузить новую структуру
  const wfPath = join(__dirname, '..', 'n8n-workflows', 'rentprog-history-parser-parallel-v3.json');
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

  // 4. Активировать
  await fetch(`${N8N_HOST}/workflows/${existing.id}/activate`, {
    method: 'POST',
    headers,
    body: '{}'
  });

  console.log('✅ Workflow активирован!\n');
  console.log('📊 Новая структура:');
  console.log('  ✅ Trigger → 4 параллельных ветки');
  console.log('  ✅ Tbilisi Pages → Get Tbilisi → Process → ...');
  console.log('  ✅ Batumi Pages → Get Batumi → Process → ...');
  console.log('  ✅ Kutaisi Pages → Get Kutaisi → Process → ...');
  console.log('  ✅ Service Pages → Get Service → Process → ...');
  console.log('  ✅ Merge All Results → Format → Alert\n');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${existing.id}`);
}

main().catch(console.error);

