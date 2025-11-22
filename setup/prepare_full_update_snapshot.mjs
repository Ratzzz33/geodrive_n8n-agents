import fs from 'fs';
import fetch from 'node-fetch';

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZDYyYjM3My0yMDFiLTQ3ZjMtODU5YS1jZGM2OWRkZWE0NGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMDg0MjY4LCJleHAiOjE3NjQ2NTE2MDB9.gsdxltowlQShNi9mil074-cMhnuJJLI5lN6MP7FQEcI";
const BASE_URL = 'https://n8n.rentflow.rentals/api/v1';
const WORKFLOW_ID = 'ihRLR0QCJySx319b';

async function prepareUpdate() {
  // 1. Получаем workflow
  const response = await fetch(`${BASE_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });
  const workflowData = await response.json();

  // 2. Читаем SQL запрос (ИСПРАВЛЕННЫЙ V4, fetched_at + ON CONSTRAINT)
  const sqlQueryPath = 'setup/fixed_snapshot_query_no_cte_v4.sql';
  const sqlQuery = fs.readFileSync(sqlQueryPath, 'utf8');

  // 3. Находим ноду и обновляем
  const workflow = workflowData;
  const saveSnapshotNode = workflow.nodes.find(node => node.name === 'Save Snapshot');

  if (saveSnapshotNode) {
    console.log('✅ Node "Save Snapshot" found.');
    saveSnapshotNode.parameters.query = sqlQuery;
    console.log('✅ Query updated to FIXED V4 (fetched_at + ON CONSTRAINT).');
  } else {
    console.error('❌ Node "Save Snapshot" not found!');
    process.exit(1);
  }

  // 4. Сохраняем обновленный workflow
  const updatedWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };

  fs.writeFileSync('setup/updated_workflow_full.json', JSON.stringify(updatedWorkflow, null, 2));
  console.log('✅ Updated workflow saved to setup/updated_workflow_full.json');
}

prepareUpdate();
