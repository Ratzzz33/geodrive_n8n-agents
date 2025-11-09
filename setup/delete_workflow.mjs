const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

const workflowId = process.argv[2] || 'K9e80NPPxABA4aJy';

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY
};

console.log(`🗑️  Удаляем workflow ${workflowId}...`);

try {
  const response = await fetch(`${N8N_HOST}/workflows/${workflowId}`, {
    method: 'DELETE',
    headers
  });

  if (response.ok) {
    console.log(`✅ Workflow ${workflowId} успешно удален!`);
  } else {
    const error = await response.text();
    console.error(`❌ Ошибка ${response.status}:`, error);
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
}

