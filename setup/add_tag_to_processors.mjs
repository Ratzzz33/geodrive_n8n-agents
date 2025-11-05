import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const PROCESSOR_WORKFLOWS = [
  { id: 'PbDKuU06H7s2Oem8', name: 'Service Center Processor Rentprog' },
  { id: 'P65bXE5Xhupkxxw6', name: 'Tbilisi Processor Rentprog' },
  { id: 'YsBma7qYsdsDykTq', name: 'Batumi Processor Rentprog' },
  { id: 'gJPvJwGQSi8455s9', name: 'Kutaisi Processor Rentprog' }
];

const TAG_NAME = 'RentProg Processors';

async function getWorkflow(id) {
  const response = await fetch(`${N8N_HOST}/workflows/${id}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${error.substring(0, 300)}`);
  }

  const result = await response.json();
  return result.data || result;
}

async function updateWorkflowTags(workflowId, workflow) {
  // Добавляем тег, если его еще нет
  const tags = workflow.tags || [];
  if (!tags.includes(TAG_NAME)) {
    tags.push(TAG_NAME);
  }

  // Обновляем только необходимые поля (n8n API требует только эти)
  const updated = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    tags: tags
  };

  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updated)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${error.substring(0, 300)}`);
  }

  return await response.json();
}

async function main() {
  console.log(`📁 Добавляю тег "${TAG_NAME}" к процессорам...\n`);

  for (const wf of PROCESSOR_WORKFLOWS) {
    try {
      console.log(`📝 Обновляю: ${wf.name} (${wf.id})...`);
      
      // Получаем текущий workflow
      const workflow = await getWorkflow(wf.id);
      
      // Обновляем теги
      const result = await updateWorkflowTags(wf.id, workflow);
      
      const tags = result.data?.tags || result.tags || [];
      console.log(`   ✅ Теги: ${tags.join(', ') || '(пусто)'}\n`);
      
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}\n`);
    }
  }

  console.log('✅ Готово!');
}

main().catch(console.error);

