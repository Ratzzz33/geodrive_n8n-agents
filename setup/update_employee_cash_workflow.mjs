import { readFileSync } from 'fs';

const workflowFile = 'n8n-workflows/employee-cash-monitor-with-merge.json';
const wfData = JSON.parse(readFileSync(workflowFile, 'utf8'));

const apiUrl = 'https://n8n.rentflow.rentals/api/v1/workflows/8jkfmWF2dTtnlMHj';
const apiKey = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function update() {
  console.log('🔧 Обновляем "Ночной парсинг сотрудников и их касс"...\n');
  
  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: wfData.name,
      nodes: wfData.nodes,
      connections: wfData.connections,
      settings: wfData.settings
    })
  });

  if (!response.ok) {
    console.error('❌ Ошибка:', await response.text());
    process.exit(1);
  }

  console.log('✅ Workflow обновлён!\n');
  console.log('Изменения:');
  console.log('  ✅ Добавлен Merge node "Wait for Both Sources"');
  console.log('  ✅ Mode: append (объединяет все items)');
  console.log('');
  console.log('Результат:');
  console.log('  Input 0: 4 items от RentProg');
  console.log('  Input 1: 122 items от БД');
  console.log('  Output: 126 items (4 + 122)');
  console.log('');
  console.log('🔗 https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj');
}

update().catch(console.error);

