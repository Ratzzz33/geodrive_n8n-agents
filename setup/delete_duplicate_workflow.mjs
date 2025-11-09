const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

// Удаляем старый дубликат
const OLD_WORKFLOW_ID = 'rVAtZ9Ouser8GbLx';

console.log(`🗑️  Удаление дубликата workflow (ID: ${OLD_WORKFLOW_ID})...\n`);

try {
  const response = await fetch(`${N8N_HOST}/workflows/${OLD_WORKFLOW_ID}`, {
    method: 'DELETE',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  console.log('✅ Дубликат удален успешно!');
  console.log('\n📋 Остался только один workflow:');
  console.log('   Error Handler - AI Agent (RNuZ1U40BIF9bnkJ)');
  console.log('   https://n8n.rentflow.rentals/workflow/RNuZ1U40BIF9bnkJ');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
}

