import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_HOST = 'https://n8n.rentflow.rentals/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI';

async function importWorkflow() {
  try {
    // Read workflow file
    const wfContent = readFileSync(
      join(__dirname, '..', 'n8n-workflows', 'rentprog-car-states-reconciliation-v2.json'),
      'utf-8'
    );
    const wfJson = JSON.parse(wfContent);

    console.log('🔍 Checking for existing workflow...');

    // Get all workflows
    const listResponse = await fetch(`${N8N_HOST}/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list workflows: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    const existingWf = listData.data.find(wf => wf.name === wfJson.name);

    if (existingWf) {
      console.log(`✅ Found existing workflow: ${existingWf.id}`);
      console.log('🔄 Updating workflow...');

      // Update existing workflow
      const updatePayload = {
        name: wfJson.name,
        nodes: wfJson.nodes,
        connections: wfJson.connections,
        settings: wfJson.settings
      };

      const updateResponse = await fetch(`${N8N_HOST}/workflows/${existingWf.id}`, {
        method: 'PUT',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update workflow: ${updateResponse.statusText}\n${errorText}`);
      }

      const updateData = await updateResponse.json();
      const workflowId = updateData.data?.id || updateData.id || existingWf.id;
      console.log(`✅ Workflow updated successfully: ${workflowId}`);
      console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${workflowId}`);

    } else {
      console.log('📝 Creating new workflow...');

      // Create new workflow
      const createPayload = {
        name: wfJson.name,
        nodes: wfJson.nodes,
        connections: wfJson.connections,
        settings: wfJson.settings
      };

      const createResponse = await fetch(`${N8N_HOST}/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createPayload)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create workflow: ${createResponse.statusText}\n${errorText}`);
      }

      const createData = await createResponse.json();
      console.log(`✅ Workflow created successfully: ${createData.data.id}`);
      console.log(`🔗 URL: https://n8n.rentflow.rentals/workflow/${createData.data.id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

importWorkflow();

