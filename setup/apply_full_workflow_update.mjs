import fs from 'fs';
import fetch from 'node-fetch';

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';
const WORKFLOW_ID = 'ihRLR0QCJySx319b';

async function updateWorkflow() {
  try {
    const workflowData = JSON.parse(fs.readFileSync('setup/updated_workflow_full.json', 'utf8'));

    console.log(`🔄 Updating workflow ${WORKFLOW_ID}...`);

    const response = await fetch(`${N8N_HOST}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update workflow: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Workflow updated successfully!');
    console.log(`ID: ${result.id}`);
    console.log(`Name: ${result.name}`);
    console.log(`Active: ${result.active}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateWorkflow();

