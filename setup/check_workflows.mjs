const N8N_HOST = "https://n8n.rentflow.rentals/api/v1";
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";

const response = await fetch(`${N8N_HOST}/workflows`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const result = await response.json();
const workflows = result.data || [];

console.log('📋 Все workflows в n8n:\n');
workflows.forEach((wf, index) => {
  console.log(`${index + 1}. ${wf.name}`);
  console.log(`   ID: ${wf.id}`);
  console.log(`   Active: ${wf.active ? '✅' : '❌'}`);
  console.log('');
});

console.log(`Всего: ${workflows.length} workflows`);

// Ищем Error workflows
const errorWorkflows = workflows.filter(wf => 
  wf.name.toLowerCase().includes('error')
);

if (errorWorkflows.length > 0) {
  console.log('\n🔍 Error workflows:');
  errorWorkflows.forEach(wf => {
    console.log(`   - ${wf.name} (${wf.id})`);
  });
}

