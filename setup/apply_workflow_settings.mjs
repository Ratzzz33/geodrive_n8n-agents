import { readFileSync } from 'fs';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// Стандартные настройки для всех workflows
// ⚠️ НЕ используем errorWorkflow - эта настройка больше не используется (вызывала ошибки)
const STANDARD_SETTINGS = {
  executionOrder: "v1",
  timezone: "Asia/Tbilisi",
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
  saveManualExecutions: true,
  saveExecutionProgress: true,
  executionTimeout: 3600 // 1 hour in seconds
};

async function main() {
  console.log('📋 Получаем список всех workflows...\n');

  // Получить все workflows
  const listRes = await fetch(`${N8N_HOST}/workflows`, { headers });
  const { data: workflows } = await listRes.json();

  console.log(`Найдено workflows: ${workflows.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const wf of workflows) {
    try {
      console.log(`⚙️  Обрабатываем: ${wf.name} (${wf.id})`);

      // Получить полный workflow
      const getRes = await fetch(`${N8N_HOST}/workflows/${wf.id}`, { headers });
      const response = await getRes.json();
      const fullWorkflow = response.data || response;

      // Обновить только settings, остальное не трогать
      const updatedWorkflow = {
        name: fullWorkflow.name,
        nodes: fullWorkflow.nodes,
        connections: fullWorkflow.connections,
        settings: STANDARD_SETTINGS
      };

      // Отправить обновление
      const updateRes = await fetch(`${N8N_HOST}/workflows/${wf.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatedWorkflow)
      });

      if (updateRes.ok) {
        console.log(`   ✅ Обновлен\n`);
        updated++;
      } else {
        const error = await updateRes.text();
        console.log(`   ❌ Ошибка: ${error}\n`);
        skipped++;
      }

    } catch (err) {
      console.log(`   ❌ Ошибка: ${err.message}\n`);
      skipped++;
    }
  }

  console.log('\n📊 Результаты:');
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  console.log('\n✅ Готово! Теперь все workflows имеют единые настройки.');
}

main().catch(console.error);

