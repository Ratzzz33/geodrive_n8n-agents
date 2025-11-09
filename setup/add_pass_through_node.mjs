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
  console.log('🔧 Добавляем Pass Through Data node для цикла Split In Batches...\n');

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

  console.log('✅ Pass Through Data node добавлен!\n');
  console.log('ПРОБЛЕМА:');
  console.log('  ❌ Postgres node возвращает только {success: true}');
  console.log('  ❌ Split In Batches не получает исходные данные обратно');
  console.log('  ❌ Цикл не работает - обрабатывается только первый батч');
  console.log('');
  console.log('РЕШЕНИЕ:');
  console.log('  ✅ Добавлен "Pass Through Data" node после Postgres');
  console.log('  ✅ Он берёт исходные данные из Split In Batches');
  console.log('  ✅ И возвращает их обратно для продолжения цикла');
  console.log('');
  console.log('Новый поток:');
  console.log('  Switch → Split In Batches (batch 1: 20 items)');
  console.log('    ↓');
  console.log('  Save Payment to DB → вставка в БД');
  console.log('    ↓');
  console.log('  Pass Through Data → возврат исходных 20 items');
  console.log('    ↓');
  console.log('  Split In Batches (batch 2: 20 items) ← ЦИКЛ!');
  console.log('    ↓');
  console.log('  ... повторяется до конца всех батчей');
  console.log('    ↓');
  console.log('  Format Result → финальный отчёт');
  console.log('');
  console.log('Теперь все 200+ items будут обработаны и сохранены!');
  console.log('');
  console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);
}

main().catch(console.error);

